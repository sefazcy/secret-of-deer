"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { deriveIdentityRef } from "@/lib/crypto";
import { generateTicketCode } from "@/lib/ticket";
import { getCurrentIdentity, getCurrentProfileId } from "@/features/auth/dal";
import { PARTICIPANT_COUNT_TAG } from "@/features/event/queries";
import { aliasKey, generateAlias, normalizeAlias } from "./alias";
import { aliasStepSchema, profileSchema, type ProfileInput } from "./schemas";

type ProfileField = keyof ProfileInput;

export type AliasCheckResult = { ok: true; alias: string } | { ok: false; message: string };
export type UpdateProfileResult = { ok: true } | CreateProfileResult;
export type CreateProfileResult = {
  ok: false;
  message: string;
  fieldErrors?: Partial<Record<ProfileField, string>>;
  /** Hatanın düzeltileceği sihirbaz adımı. */
  step?: 1 | 2 | 3;
};

const STEP_OF: Record<ProfileField, 1 | 2 | 3> = {
  alias: 1,
  avatarId: 1,
  interests: 2,
  budgetTier: 2,
  giftHints: 3,
  giftExclusions: 3,
};

/** Rumuz başka bir profil tarafından alınmış mı? (Düzenlemede kişinin kendi rumuzu sayılmaz.) */
async function isAliasTaken(alias: string, exceptProfileId?: string | null): Promise<boolean> {
  const hit = await db.participantProfile.findUnique({ where: { aliasKey: aliasKey(alias) }, select: { id: true } });
  return !!hit && hit.id !== exceptProfileId;
}

async function requireIdentity() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/kayit");
  return identity;
}

function parseProfile(input: ProfileInput) {
  const parsed = profileSchema.safeParse(input);
  if (parsed.success) return { ok: true as const, data: parsed.data };
  const fieldErrors: Partial<Record<ProfileField, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as ProfileField;
    fieldErrors[key] ??= issue.message;
  }
  const firstField = Object.keys(fieldErrors)[0] as ProfileField;
  const error: CreateProfileResult = { ok: false, message: fieldErrors[firstField]!, fieldErrors, step: STEP_OF[firstField] };
  return { ok: false as const, error };
}

const ALIAS_TAKEN = "Bu rumuz alınmış 🦊 Başka bir tane dene ya da rastgele üret.";

/** Adım 1'den çıkarken: rumuz geçerli ve boşta mı? */
export async function checkAlias(alias: string): Promise<AliasCheckResult> {
  await requireIdentity();
  const parsed = aliasStepSchema.shape.alias.safeParse(alias);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]!.message };
  if (await isAliasTaken(parsed.data, await getCurrentProfileId())) return { ok: false, message: ALIAS_TAKEN };
  return { ok: true, alias: parsed.data };
}

/** "Rastgele rumuz üret": şu an boşta olan, Hacettepe temalı bir rumuz döndürür. */
export async function suggestAlias(): Promise<string> {
  await requireIdentity();
  for (let i = 0; i < 25; i++) {
    const candidate = generateAlias();
    if (!(await isAliasTaken(candidate))) return candidate;
  }
  // Kombinasyonlar tükenmeye yakınsa sayı ekle.
  for (;;) {
    const candidate = `${generateAlias()} ${Math.floor(10 + Math.random() * 90)}`;
    if (!(await isAliasTaken(candidate))) return candidate;
  }
}

/** Sihirbazın son adımı: anonim profili oluştur ve panele yönlendir. */
export async function createProfile(input: ProfileInput): Promise<CreateProfileResult> {
  const identity = await requireIdentity();

  const parsed = parseProfile(input);
  if (!parsed.ok) return parsed.error;
  const data = parsed.data;

  const settings = await db.eventSettings.findUnique({ where: { id: 1 }, select: { phase: true } });
  if (settings && settings.phase !== "REGISTRATION") {
    return { ok: false, message: "Kayıtlar kapandı, artık yeni profil oluşturulamıyor." };
  }

  const identityRef = deriveIdentityRef(identity.profileToken);
  if (await db.participantProfile.findUnique({ where: { identityRef }, select: { id: true } })) {
    redirect("/panel"); // Zaten profili var (ör. çift tıklama ya da ikinci sekme).
  }

  const alias = normalizeAlias(data.alias);

  // Bilet kodu çakışması çok düşük ihtimal; yine de birkaç kez dene.
  let created = false;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    try {
      await db.participantProfile.create({
        data: {
          identityRef,
          alias,
          aliasKey: aliasKey(alias),
          avatarId: data.avatarId,
          budgetTier: data.budgetTier,
          giftHints: data.giftHints,
          giftExclusions: data.giftExclusions,
          ticketCode: generateTicketCode(),
          interests: { create: data.interests.map((interestSlug) => ({ interestSlug })) },
        },
      });
      created = true;
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") throw err;
      // Hangi alanın çakıştığını veritabanı sürücüsüne göre değişen meta'dan değil, sorgudan anla.
      if (await isAliasTaken(alias)) {
        return { ok: false, message: ALIAS_TAKEN, fieldErrors: { alias: ALIAS_TAKEN }, step: 1 };
      }
      if (await db.participantProfile.findUnique({ where: { identityRef }, select: { id: true } })) {
        redirect("/panel");
      }
      // Aksi hâlde bilet kodu çakıştı → yeni kodla tekrar dene.
    }
  }
  if (!created) return { ok: false, message: "Profil oluşturulamadı. Lütfen tekrar dene." };

  updateTag(PARTICIPANT_COUNT_TAG);
  redirect("/panel");
}

/**
 * Panelden profil düzenleme. Yalnızca kayıt fazında (eşleşmeler ilgi alanı ve bütçeye göre
 * yapıldığı için sonrasında değişiklik eşleşmeyi bozar).
 */
export async function updateProfile(input: ProfileInput): Promise<UpdateProfileResult> {
  const identity = await requireIdentity();
  const parsed = parseProfile(input);
  if (!parsed.ok) return parsed.error;
  const data = parsed.data;

  const settings = await db.eventSettings.findUnique({ where: { id: 1 }, select: { phase: true } });
  if (settings && settings.phase !== "REGISTRATION") {
    return { ok: false, message: "Eşleşmeler yapıldıktan sonra profil değiştirilemez." };
  }

  const profile = await db.participantProfile.findUnique({
    where: { identityRef: deriveIdentityRef(identity.profileToken) },
    select: { id: true },
  });
  if (!profile) redirect("/profil-olustur");

  const alias = normalizeAlias(data.alias);
  if (await isAliasTaken(alias, profile.id)) {
    return { ok: false, message: ALIAS_TAKEN, fieldErrors: { alias: ALIAS_TAKEN }, step: 1 };
  }

  try {
    await db.$transaction([
      db.profileInterest.deleteMany({ where: { profileId: profile.id } }),
      db.participantProfile.update({
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
      }),
    ]);
  } catch (err) {
    // Kontrol ile yazma arasında başkası aynı rumuzu aldıysa.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, message: ALIAS_TAKEN, fieldErrors: { alias: ALIAS_TAKEN }, step: 1 };
    }
    throw err;
  }
  return { ok: true };
}
