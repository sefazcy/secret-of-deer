import type { PrismaClient } from "../../generated/prisma/client";
import { lockPhase, PhaseError, readPhase, recordAudit, transitionPhase, type DbClient } from "../event/phase";
import { planMatching, type MatchingPlan } from "./algorithm";

/** Büyük gruplarda Macar algoritması (O(n³)) varsayılan 5 sn'lik transaction süresini aşmasın. */
const MATCHING_TX_TIMEOUT_MS = 60_000;

/** Eşleştirmeye girecek profiller (jokerler dahil). */
async function loadCandidates(db: DbClient) {
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

/**
 * Veritabanına yazmadan eşleştirmeyi dener (admin "Simüle Et"). Yalnızca kayıt fazında.
 * Faz kontrolü ve aday okuması aynı transaction'da yapılır.
 */
export async function simulateMatching(db: PrismaClient): Promise<MatchingSummary> {
  return db.$transaction(
    async (tx) => {
      const phase = await readPhase(tx);
      if (phase !== "REGISTRATION") throw new PhaseError("wrong_phase", phase);
      return summarize(planMatching(await loadCandidates(tx)));
    },
    { timeout: MATCHING_TX_TIMEOUT_MS },
  );
}

/**
 * Eşleştirmeyi kesinleştirir — tek transaction, sırasıyla:
 *   1. Faz kilidi (`phase = REGISTRATION` koşuluyla). Kilit transaction sonuna kadar tutulur;
 *      profil oluşturma/güncelleme ve joker ekleme/çıkarma da aynı kilidi aldığından,
 *      adaylar okunduktan sonra havuza kimse sızamaz ya da havuzdan çıkamaz.
 *   2. Adayları oku, planla. Plan geçersizse (ör. 1 kişilik grup) hiçbir şey yazılmaz.
 *   3. Eşleşmeleri yaz, fazı koşullu olarak MATCHED yap, denetim kaydı ekle.
 * Faz uygun değilse ya da ayar satırı yoksa `PhaseError` fırlatır.
 */
export async function finalizeMatching(db: PrismaClient): Promise<MatchingSummary> {
  return db.$transaction(
    async (tx) => {
      await lockPhase(tx, ["REGISTRATION"]);
      const candidates = await loadCandidates(tx);
      const plan = planMatching(candidates);
      const summary = summarize(plan);
      if (!plan.isValid) return summary;

      const rows = plan.groups.flatMap((g) =>
        g.assignments.map((a) => ({
          giverProfileId: a.giverId,
          receiverProfileId: a.receiverId,
          commonInterestsCount: a.commonInterestsCount,
        })),
      );

      await tx.match.deleteMany();
      await tx.match.createMany({ data: rows });
      await transitionPhase(tx, "REGISTRATION", "MATCHED", { matchesFinalizedAt: new Date() });
      await recordAudit(tx, "MATCHES_FINALIZED", { profiles: candidates.length, matches: rows.length });
      return summary;
    },
    { timeout: MATCHING_TX_TIMEOUT_MS },
  );
}
