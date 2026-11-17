import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";

/**
 * Neon adresleri `sslmode=require` ile gelir. pg 8 bunu bugün `verify-full` (sertifika + ana makine
 * doğrulaması) gibi uygular, ama pg 9'da sertifikayı doğrulamayan libpq anlamına geçecek. Güvenli
 * davranışı sürüm değişse de korumak için açıkça `verify-full` istenir.
 */
export function withStrictSsl(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const mode = url.searchParams.get("sslmode");
    if (mode === "require" || mode === "prefer" || mode === "verify-ca") url.searchParams.set("sslmode", "verify-full");
    return url.toString();
  } catch {
    return connectionString;
  }
}

/**
 * PostgreSQL bağlantısı: Neon + Vercel için önerilen yol, yani node-postgres (`pg`) havuzu ve
 * üstünde Prisma (`@prisma/adapter-pg`).
 *
 * - DATABASE_URL: Neon'un **havuzlu** adresi (`-pooler`), uygulama trafiği için. `neon env pull`
 *   / `neon deploy` bunu `.env`'e yazar; Vercel'de de aynı adla tanımlanır.
 * - DATABASE_URL_UNPOOLED: doğrudan adres, yalnızca migration'lar için (bkz. prisma.config.ts).
 *
 * Havuz modül düzeyinde bir kez açılır ve örnek başına küçük tutulur: her Vercel örneği kendi
 * havuzunu tuttuğu için toplam bağlantı sayısı örnek sayısıyla artar.
 */
function createClient() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL tanımlı değil.");

  const pool = new Pool({
    connectionString: withStrictSsl(raw),
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
  });
  // Vercel Fluid compute: örnek askıya alınmadan önce boşta kalan bağlantıları düzgünce bırakır.
  // Yalnızca Vercel çalışma zamanında bağlanır (VERCEL_REGION build sırasında tanımlı değildir):
  // kütüphane `pool.connect`'i sarıp her bağlantıda Date.now() okur; bu, build'deki önceden render
  // (Cache Components) sırasında "kararsız değer" hatasına yol açar ve Vercel dışında zaten işlevsizdir.
  if (process.env.VERCEL_REGION) attachDatabasePool(pool);
  // Neon havuzlayıcısının kapattığı boşta bağlantılar `error` olayı üretir; dinleyici olmazsa
  // süreç çöker. Bağlantı adresi ya da sorgu içeriği log'a yazılmaz.
  pool.on("error", (err) => {
    console.error(`[db] boşta bağlantı hatası (${(err as { code?: string }).code ?? err.name})`);
  });

  return new PrismaClient({
    adapter: new PrismaPg(pool),
    // Faz kilidi (src/features/event/phase.ts) eşzamanlı yazmaları sıraya koyar; yoğun kayıt
    // anında kilit için bekleyen transaction'lar varsayılan 2 sn / 5 sn sınırlarına takılmasın.
    transactionOptions: { maxWait: 10_000, timeout: 15_000 },
  });
}

// Geliştirmede hot-reload her seferinde yeni havuz açmasın diye tek örnek.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
