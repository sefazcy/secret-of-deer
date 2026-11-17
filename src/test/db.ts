import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";
import { PrismaClient } from "../generated/prisma/client";

const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

function migrationScripts(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((n) => /^\d+_/.test(n))
    .sort()
    .map((name) => readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8"));
}

let schemaCounter = 0;

/**
 * Entegrasyon testleri için boş, migration'ları uygulanmış bir PostgreSQL veritabanı.
 * Uygulama ile birebir aynı yol kullanılır: `@prisma/adapter-pg` + `pg` sürücüsü.
 *
 * - `TEST_DATABASE_URL` tanımlıysa (CI, yerel Postgres): o sunucuda her test için ayrı, geçici
 *   bir şema açılır ve test sonunda silinir. Eşzamanlılık testleri gerçek satır kilitleriyle çalışır.
 * - Tanımlı değilse: süreç içi PGlite (WASM PostgreSQL) bir TCP soketi üzerinden sunulur.
 *   PGlite tek oturumlu olduğu için havuz 1 bağlantıyla sınırlıdır; transaction'lar sıraya girer.
 *
 * Gerçek veritabanına (DATABASE_URL) asla dokunmaz.
 */
export async function createTestDb(opts: { seedSettings?: boolean } = {}) {
  const external = process.env.TEST_DATABASE_URL;
  let db: PrismaClient;
  let teardown: () => Promise<void>;

  if (external) {
    const schema = `test_${process.pid}_${Date.now()}_${schemaCounter++}`;
    const admin = new Client({ connectionString: external });
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    for (const sql of migrationScripts()) await admin.query(sql);
    db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: external, max: 10 }, { schema }),
      transactionOptions: { maxWait: 20_000, timeout: 30_000 },
    });
    teardown = async () => {
      await db.$disconnect();
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.end();
    };
  } else {
    const pglite = await PGlite.create();
    for (const sql of migrationScripts()) await pglite.exec(sql);
    const server = new PGLiteSocketServer({ db: pglite, host: "127.0.0.1", port: 0, maxConnections: 1 });
    await server.start();
    const [host, port] = server.getServerConn().split(":");
    db = new PrismaClient({
      adapter: new PrismaPg({ host, port: Number(port), user: "postgres", database: "postgres", max: 1 }),
      // Tek bağlantıda eşzamanlı transaction'lar sırayla bekler.
      transactionOptions: { maxWait: 60_000, timeout: 60_000 },
    });
    teardown = async () => {
      await db.$disconnect();
      await server.stop();
      await pglite.close();
    };
  }

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

  return { db, cleanup: teardown };
}
