import type { PrismaClient } from "../../generated/prisma/client";
import type { BudgetTierKey } from "../../lib/constants";
import { lockPhase, lockSettings, recordAudit, transitionPhase } from "../event/phase";
import { aliasKey } from "../profile/alias";
import { generateUniqueTicketCode } from "../profile/service";
import { pickJokerInterests } from "./joker";

/**
 * Yönetim işlemlerinin veritabanı tarafı. Her biri tek `$transaction` içinde, önce faz kilidi
 * alıp sonra yazar; faz uygun değilse ya da ayar satırı yoksa `PhaseError` fırlatır.
 */

const JOKER_PREFIX = "Joker Geyik";
const FALLBACK_INTERESTS = ["kitap", "kahve", "muzik"];

/** Kayıt fazında gruba joker ekler; eklenen jokerin rumuzunu döndürür. */
export async function addJokerRecord(db: PrismaClient, tier: BudgetTierKey): Promise<string> {
  return db.$transaction(async (tx) => {
    await lockPhase(tx, ["REGISTRATION"]);

    const group = await tx.participantProfile.findMany({
      where: { budgetTier: tier },
      select: { interests: { select: { interestSlug: true } } },
    });
    const interests = pickJokerInterests(group.map((p) => p.interests.map((i) => i.interestSlug)));
    if (interests.length < 3) interests.push(...FALLBACK_INTERESTS.filter((s) => !interests.includes(s)));

    // "Joker Geyik 1", "Joker Geyik 2"… boşta olan ilk numara (tek sorgu, sınırlı arama).
    const taken = new Set(
      (
        await tx.participantProfile.findMany({
          where: { aliasKey: { startsWith: aliasKey(`${JOKER_PREFIX} `) } },
          select: { aliasKey: true },
        })
      ).map((p) => p.aliasKey),
    );
    let n = 1;
    while (taken.has(aliasKey(`${JOKER_PREFIX} ${n}`))) n++;
    const alias = `${JOKER_PREFIX} ${n}`;

    await tx.participantProfile.create({
      data: {
        alias,
        aliasKey: aliasKey(alias),
        avatarId: "geyik",
        budgetTier: tier,
        isJoker: true,
        giftHints: "Organizasyon ekibinden gönüllü joker 🦌",
        ticketCode: await generateUniqueTicketCode(tx),
        interests: { create: interests.slice(0, 7).map((interestSlug) => ({ interestSlug })) },
      },
    });
    return alias;
  });
}

/** Kayıt fazında jokeri kaldırır. Silindiyse true. */
export async function removeJokerRecord(db: PrismaClient, profileId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    await lockPhase(tx, ["REGISTRATION"]);
    const { count } = await tx.participantProfile.deleteMany({ where: { id: profileId, isJoker: true } });
    return count === 1;
  });
}

/** MATCHED → EVENT_DAY (koşullu geçiş + denetim kaydı). */
export async function startEventDayRecord(db: PrismaClient): Promise<void> {
  await db.$transaction(async (tx) => {
    await transitionPhase(tx, "MATCHED", "EVENT_DAY");
    await recordAudit(tx, "EVENT_DAY_STARTED", { profiles: await tx.participantProfile.count() });
  });
}

export type PurgeCounts = { identities: number; profiles: number; interests: number; matches: number };

/**
 * Tüm kişisel verileri tek transaction'da siler, fazı CLOSED yapar ve oturum dönemini artırır
 * (imhadan önce açılmış tüm öğrenci/ekip oturumları geçersiz olur). Denetim kaydı yalnızca
 * sayıları içerir ve imhadan etkilenmez. Ayar satırı yoksa `PhaseError("missing_settings")`.
 */
export async function purgeAllRecords(db: PrismaClient): Promise<PurgeCounts> {
  return db.$transaction(async (tx) => {
    await lockSettings(tx);
    const matches = await tx.match.deleteMany();
    const interests = await tx.profileInterest.deleteMany();
    const profiles = await tx.participantProfile.deleteMany();
    const identities = await tx.authIdentity.deleteMany();
    await tx.eventSettings.update({
      where: { id: 1 },
      data: { phase: "CLOSED", dataPurgedAt: new Date(), sessionEpoch: { increment: 1 } },
    });
    const counts = {
      identities: identities.count,
      profiles: profiles.count,
      interests: interests.count,
      matches: matches.count,
    };
    await recordAudit(tx, "DATA_PURGED", counts);
    return counts;
  });
}
