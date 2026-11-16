/**
 * Veritabanı başlangıç verisi.
 *   npm run db:seed              → yalnızca etkinlik ayarları
 *   SEED_DEMO=1 npm run db:seed  → + 12 anonim demo profil (yalnızca geliştirme için!)
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { generateTicketCode } from "../src/lib/ticket";
import { aliasKey } from "../src/features/profile/alias";
import { AVATAR_IDS, BUDGET_TIER_KEYS, INTEREST_SLUGS } from "../src/lib/constants";

async function main() {
  await db.eventSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      registrationClosesAt: new Date("2026-12-15T23:59:00+03:00"),
      eventStartsAt: new Date("2026-12-26T18:00:00+03:00"),
      location: "Beytepe Kampüsü",
    },
  });
  console.log("✔ Etkinlik ayarları hazır.");

  if (process.env.SEED_DEMO !== "1") return;
  if (process.env.NODE_ENV === "production") throw new Error("Demo verisi üretimde eklenemez.");

  const demoNames = [
    "Beytepe Tilkisi", "Kütüphane Baykuşu", "Ring Kedisi", "Kantin Sincabı",
    "Amfi Kirpisi", "Göl Kenarı Geyiği", "Sıhhiye Martısı", "Final Haftası Ayısı",
    "Kar Tanesi Tavşanı", "Yemekhane Kargası", "Laboratuvar Kurdu", "Kampüs Pengueni",
  ];

  for (const [i, alias] of demoNames.entries()) {
    const interests = [...INTEREST_SLUGS].sort(() => Math.random() - 0.5).slice(0, 3 + (i % 5));
    await db.participantProfile.upsert({
      where: { alias },
      update: {},
      create: {
        alias,
        aliasKey: aliasKey(alias),
        avatarId: AVATAR_IDS[i % AVATAR_IDS.length]!,
        budgetTier: BUDGET_TIER_KEYS[i % 2]!,
        giftHints: "Demo profil — kupa, defter ya da güzel bir kahve olabilir.",
        ticketCode: generateTicketCode(),
        interests: { create: interests.map((interestSlug) => ({ interestSlug })) },
      },
    });
  }
  console.log(`✔ ${demoNames.length} demo profil eklendi.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
