import type { PrismaClient } from "../../generated/prisma/client";
import { planMatching, type MatchingPlan } from "./algorithm";

/** Eşleştirmeye girecek profiller (jokerler dahil). */
async function loadCandidates(db: PrismaClient) {
  const profiles = await db.participantProfile.findMany({
    select: { id: true, budgetTier: true, interests: { select: { interestSlug: true } } },
  });
  return profiles.map((p) => ({
    id: p.id,
    budgetTier: p.budgetTier,
    interests: p.interests.map((i) => i.interestSlug),
  }));
}

/** Gizlilik: plan özeti kimin kime çıktığını içermez, yalnızca grup istatistiği döner. */
export type MatchingSummary = {
  isValid: boolean;
  warnings: string[];
  groups: Array<{
    budgetTier: string;
    size: number;
    isOdd: boolean;
    matched: number;
    withCommonInterestRatio: number;
    avgCommonInterests: number;
  }>;
};

function summarize(plan: MatchingPlan): MatchingSummary {
  return {
    isValid: plan.isValid,
    warnings: plan.warnings,
    groups: plan.groups.map((g) => ({
      budgetTier: g.budgetTier,
      size: g.size,
      isOdd: g.isOdd,
      matched: g.assignments.length,
      withCommonInterestRatio: g.withCommonInterestRatio,
      avgCommonInterests: g.assignments.length ? g.totalCommonInterests / g.assignments.length : 0,
    })),
  };
}

/** Veritabanına yazmadan eşleştirmeyi dener (admin "Simüle Et"). */
export async function simulateMatching(db: PrismaClient): Promise<MatchingSummary> {
  return summarize(planMatching(await loadCandidates(db)));
}

/**
 * Eşleştirmeyi kesinleştirir: eski eşleşmeleri siler, yenilerini yazar ve fazı MATCHED yapar.
 * Plan geçersizse (ör. 1 kişilik grup) hiçbir şey yazılmaz.
 */
export async function finalizeMatching(db: PrismaClient): Promise<MatchingSummary> {
  const plan = planMatching(await loadCandidates(db));
  const summary = summarize(plan);
  if (!plan.isValid) return summary;

  const rows = plan.groups.flatMap((g) =>
    g.assignments.map((a) => ({
      giverProfileId: a.giverId,
      receiverProfileId: a.receiverId,
      commonInterestsCount: a.commonInterestsCount,
    })),
  );

  await db.$transaction([
    db.match.deleteMany(),
    db.match.createMany({ data: rows }),
    db.eventSettings.update({ where: { id: 1 }, data: { phase: "MATCHED", matchesFinalizedAt: new Date() } }),
  ]);
  return summary;
}
