import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { generateTicketCode } from "../../lib/ticket";
import { lockPhase, type DbClient } from "../event/phase";
import { aliasKey, normalizeAlias } from "./alias";
import type { ProfileInput } from "./schemas";

/**
 * Profil yazma işlemleri — `db` parametresiyle (sunucu aksiyonları ve entegrasyon testleri ortak kullanır).
 * Tüm yazmalar faz kilidi (`lockPhase(["REGISTRATION"])`) altındadır: eşleştirme kesinleşirken
 * havuza yeni profil sızamaz, kayıt fazı bittikten sonra profil değiştirilemez.
 */

export type CreateProfileOutcome =
  | { status: "created"; profileId: string }
  | { status: "exists" }
  | { status: "alias_taken" }
  | { status: "failed" };

export type UpdateProfileOutcome = { status: "updated" } | { status: "no_profile" } | { status: "alias_taken" };

/** Rumuz başka bir profil tarafından alınmış mı? (Düzenlemede kişinin kendi rumuzu sayılmaz.) */
export async function isAliasTaken(db: DbClient, alias: string, exceptProfileId?: string | null): Promise<boolean> {
  const hit = await db.participantProfile.findUnique({ where: { aliasKey: aliasKey(alias) }, select: { id: true } });
  return !!hit && hit.id !== exceptProfileId;
}

/**
 * Kullanılmayan bir bilet kodu. Faz kilidi altında çağrıldığında (tüm profil eklemeleri aynı
 * kilidi aldığı için) kontrol ile ekleme arasında başka bir ekleme araya giremez.
 */
export async function generateUniqueTicketCode(tx: DbClient, attempts = 8): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const code = generateTicketCode();
    if (!(await tx.participantProfile.findUnique({ where: { ticketCode: code }, select: { id: true } }))) return code;
  }
  throw new Error("Benzersiz bilet kodu üretilemedi.");
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/** Faz uygun değilse ya da ayar satırı yoksa `PhaseError` fırlatır. */
export async function createProfileRecord(
  db: PrismaClient,
  identityRef: string,
  data: ProfileInput,
): Promise<CreateProfileOutcome> {
  const alias = normalizeAlias(data.alias);
  try {
    return await db.$transaction(async (tx): Promise<CreateProfileOutcome> => {
      await lockPhase(tx, ["REGISTRATION"]);

      // Zaten profili var (ör. çift tıklama ya da ikinci sekme).
      if (await tx.participantProfile.findUnique({ where: { identityRef }, select: { id: true } })) {
        return { status: "exists" };
      }
      if (await isAliasTaken(tx, alias)) return { status: "alias_taken" };

      const created = await tx.participantProfile.create({
        data: {
          identityRef,
          alias,
          aliasKey: aliasKey(alias),
          avatarId: data.avatarId,
          budgetTier: data.budgetTier,
          giftHints: data.giftHints,
          giftExclusions: data.giftExclusions,
          ticketCode: await generateUniqueTicketCode(tx),
          interests: { create: data.interests.map((interestSlug) => ({ interestSlug })) },
        },
        select: { id: true },
      });
      return { status: "created", profileId: created.id };
    });
  } catch (err) {
    // Kilit sayesinde beklenmez; yine de (ör. kilit dışı bir yazma) benzersizlik ihlalini anlamlı döndür.
    if (!isUniqueViolation(err)) throw err;
    if (await db.participantProfile.findUnique({ where: { identityRef }, select: { id: true } })) {
      return { status: "exists" };
    }
    if (await isAliasTaken(db, alias)) return { status: "alias_taken" };
    return { status: "failed" };
  }
}

/** Yalnızca kayıt fazında. Faz uygun değilse `PhaseError`. */
export async function updateProfileRecord(
  db: PrismaClient,
  identityRef: string,
  data: ProfileInput,
): Promise<UpdateProfileOutcome> {
  const alias = normalizeAlias(data.alias);
  try {
    return await db.$transaction(async (tx): Promise<UpdateProfileOutcome> => {
      await lockPhase(tx, ["REGISTRATION"]);

      const profile = await tx.participantProfile.findUnique({ where: { identityRef }, select: { id: true } });
      if (!profile) return { status: "no_profile" };
      if (await isAliasTaken(tx, alias, profile.id)) return { status: "alias_taken" };

      await tx.profileInterest.deleteMany({ where: { profileId: profile.id } });
      await tx.participantProfile.update({
        where: { id: profile.id },
        data: {
          alias,
          aliasKey: aliasKey(alias),
          avatarId: data.avatarId,
          budgetTier: data.budgetTier,
          giftHints: data.giftHints,
          giftExclusions: data.giftExclusions,
          interests: { create: data.interests.map((interestSlug) => ({ interestSlug })) },
        },
      });
      return { status: "updated" };
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { status: "alias_taken" };
    throw err;
  }
}
