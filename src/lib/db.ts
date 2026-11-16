import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

// PostgreSQL'e geçerken:
//   npm i @prisma/adapter-pg pg
//   import { PrismaPg } from "@prisma/adapter-pg";
//   const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL tanımlı değil.");
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

// Geliştirmede hot-reload her seferinde yeni bağlantı açmasın diye tek örnek.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
