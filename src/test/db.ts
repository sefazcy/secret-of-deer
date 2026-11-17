import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

// Prisma adapter'ının kullandığı sürücü (tip paketi kurulu olmadığı için minimal arayüzle).
type RawSqlite = { exec(sql: string): void; close(): void };
const Sqlite = createRequire(import.meta.url)("better-sqlite3") as new (file: string) => RawSqlite;

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

/**
 * Entegrasyon testleri için boş, migration'ları uygulanmış geçici bir SQLite veritabanı.
 * Gerçek dev.db'ye dokunmaz. `cleanup()` istemciyi kapatıp dosyaları siler.
 */
export async function createTestDb(opts: { seedSettings?: boolean } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "beytepe-test-"));
  const file = path.join(dir, "test.db");

  const raw = new Sqlite(file);
  for (const name of readdirSync(MIGRATIONS_DIR).filter((n) => /^\d+_/.test(n)).sort()) {
    raw.exec(readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8"));
  }
  raw.close();

  const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
  if (opts.seedSettings !== false) {
    await db.eventSettings.create({
      data: {
        id: 1,
        registrationClosesAt: new Date("2026-12-15T23:59:00+03:00"),
        eventStartsAt: new Date("2026-12-26T18:00:00+03:00"),
        location: "Beytepe Kampüsü",
      },
    });
  }

  return {
    db,
    async cleanup() {
      await db.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
