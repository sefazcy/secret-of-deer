/**
 * Geliştirme aracı: etkinlik fazını değiştirir (paneli farklı fazlarda denemek için).
 *
 *   npm run dev:phase -- REGISTRATION   → eşleşmeleri siler, kayıt fazına döner
 *   npm run dev:phase -- MATCHED        → eşleştirmeyi çalıştırır ve kesinleştirir
 *   npm run dev:phase -- EVENT_DAY      → bilet modu (eşleşme yoksa önce eşleştirir)
 *
 * Üretimde çalışmaz. Gerçek akış admin panelinden yürütülecek.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { finalizeMatching } from "../src/features/matching/service";

const PHASES = ["REGISTRATION", "MATCHED", "EVENT_DAY"] as const;
type Phase = (typeof PHASES)[number];

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Bu araç üretimde kullanılamaz.");
  const target = process.argv[2]?.toUpperCase() as Phase | undefined;
  if (!target || !PHASES.includes(target)) {
    console.error(`Kullanım: npm run dev:phase -- <${PHASES.join(" | ")}>`);
    process.exit(1);
  }

  if (target === "REGISTRATION") {
    await db.$transaction([
      db.match.deleteMany(),
      db.participantProfile.updateMany({ data: { isGiftReady: false, isCheckedIn: false, checkedInAt: null } }),
      db.eventSettings.update({ where: { id: 1 }, data: { phase: "REGISTRATION", matchesFinalizedAt: null } }),
    ]);
  } else {
    if ((await db.match.count()) === 0 || target === "MATCHED") {
      const summary = await finalizeMatching(db);
      for (const g of summary.groups) {
        console.log(
          `  ${g.budgetTier}: ${g.size} kişi, %${Math.round(g.withCommonInterestRatio * 100)} ortak ilgi alanlı, ort. ${g.avgCommonInterests.toFixed(1)}`,
        );
      }
      for (const w of summary.warnings) console.warn(`  ⚠ ${w}`);
      if (!summary.isValid) throw new Error("Eşleştirme geçersiz, faz değiştirilmedi.");
    }
    await db.eventSettings.update({ where: { id: 1 }, data: { phase: target } });
  }

  console.log(`✔ Faz: ${target} (${await db.match.count()} eşleşme)`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
