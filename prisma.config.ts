import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma CLI (migrate, studio, seed) ayarı.
 * Migration'lar havuzlu (pgbouncer) bağlantıda güvenilir çalışmadığı için CLI doğrudan adresi kullanır:
 * DIRECT_URL (elle) → DATABASE_URL_UNPOOLED (Neon'un `neon env pull` ile yazdığı) → DATABASE_URL.
 * `prisma generate` veritabanına bağlanmaz; adres hiç tanımlı değilse de (ör. CI) çalışır.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
  },
});
