import { randomBytes } from "node:crypto";

/**
 * Testlerde gerçek .env'e dokunmamak için geçici, güçlü ve birbirinden farklı anahtarlar.
 * `env()` ilk çağrıda okunduğu için bu modülün test dosyasında ilk import edilmesi yeterli.
 */
export const TEST_ENV = {
  DATABASE_URL: "postgresql://unused@localhost:5432/unused",
  SESSION_SECRET: randomBytes(32).toString("base64url"),
  EMAIL_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  EMAIL_HASH_PEPPER: randomBytes(32).toString("base64url"),
  PROFILE_LINK_SECRET: randomBytes(32).toString("base64url"),
  ADMIN_PASSWORD: "Test-Admin-Password-2026!",
  CHECKIN_PASSWORD: "Kapi-Ekibi-2026",
  MAIL_MODE: "console",
} as const;

Object.assign(process.env, TEST_ENV);
