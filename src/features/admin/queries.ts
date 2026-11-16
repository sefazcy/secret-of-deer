import "server-only";
import { db } from "@/lib/db";
import { BUDGET_TIER_KEYS, type BudgetTierKey } from "@/lib/constants";

export type TierStats = { tier: BudgetTierKey; students: number; jokers: number; total: number; isOdd: boolean };

/** Joker kartı: joker ekip üyesidir; kime hediye alacağını bilmesi gerekir. */
export type JokerCard = {
  id: string;
  alias: string;
  tier: BudgetTierKey;
  ticketCode: string;
  receiver: { alias: string; interests: string[]; giftHints: string; giftExclusions: string } | null;
};

export type AdminDashboard = {
  phase: "REGISTRATION" | "MATCHED" | "EVENT_DAY" | "CLOSED";
  matchesFinalizedAt: string | null;
  dataPurgedAt: string | null;
  verifiedStudents: number;
  pendingVerifications: number;
  profiles: number;
  tiers: TierStats[];
  giftReady: { count: number; total: number };
  checkedIn: { count: number; total: number };
  matches: number;
  jokers: JokerCard[];
};

/**
 * Yönetim paneli verisi. Gizlilik: öğrenci eşleşmeleri (kim kime) asla buradan dönmez;
 * yalnızca jokerlerin (ekip üyeleri) kendi alıcıları gösterilir.
 */
export async function getAdminDashboard(): Promise<AdminDashboard> {
  const [settings, verified, pending, tierGroups, giftReady, checkedIn, total, matches, jokers] = await Promise.all([
    db.eventSettings.findUnique({ where: { id: 1 } }),
    db.authIdentity.count({ where: { isVerified: true } }),
    db.authIdentity.count({ where: { isVerified: false } }),
    db.participantProfile.groupBy({ by: ["budgetTier", "isJoker"], _count: { _all: true } }),
    db.participantProfile.count({ where: { isGiftReady: true } }),
    db.participantProfile.count({ where: { isCheckedIn: true } }),
    db.participantProfile.count(),
    db.match.count(),
    db.participantProfile.findMany({
      where: { isJoker: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        alias: true,
        budgetTier: true,
        ticketCode: true,
        givingMatch: {
          select: {
            receiver: {
              select: {
                alias: true,
                giftHints: true,
                giftExclusions: true,
                interests: { select: { interestSlug: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const tiers = BUDGET_TIER_KEYS.map((tier) => {
    const students = tierGroups.find((g) => g.budgetTier === tier && !g.isJoker)?._count._all ?? 0;
    const jokerCount = tierGroups.find((g) => g.budgetTier === tier && g.isJoker)?._count._all ?? 0;
    const sum = students + jokerCount;
    return { tier, students, jokers: jokerCount, total: sum, isOdd: sum % 2 === 1 };
  });

  return {
    phase: settings?.phase ?? "REGISTRATION",
    matchesFinalizedAt: settings?.matchesFinalizedAt?.toISOString() ?? null,
    dataPurgedAt: settings?.dataPurgedAt?.toISOString() ?? null,
    verifiedStudents: verified,
    pendingVerifications: pending,
    profiles: tiers.reduce((s, t) => s + t.students, 0),
    tiers,
    giftReady: { count: giftReady, total },
    checkedIn: { count: checkedIn, total },
    matches,
    jokers: jokers.map((j) => ({
      id: j.id,
      alias: j.alias,
      tier: j.budgetTier,
      ticketCode: j.ticketCode,
      receiver: j.givingMatch
        ? {
            alias: j.givingMatch.receiver.alias,
            interests: j.givingMatch.receiver.interests.map((i) => i.interestSlug),
            giftHints: j.givingMatch.receiver.giftHints,
            giftExclusions: j.givingMatch.receiver.giftExclusions,
          }
        : null,
    })),
  };
}
