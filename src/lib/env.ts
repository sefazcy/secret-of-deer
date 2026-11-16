import "server-only";
import { z } from "zod";

/**
 * Sunucu ortam değişkenleri. İlk erişimde doğrulanır; eksik/hatalı bir değer
 * varsa uygulama anlaşılır bir hata ile durur.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET en az 32 karakter olmalı"),
  EMAIL_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "EMAIL_ENCRYPTION_KEY 64 karakterlik hex olmalı (32 bayt)"),
  EMAIL_HASH_PEPPER: z.string().min(32),
  PROFILE_LINK_SECRET: z.string().min(32),
  ADMIN_PASSWORD: z.string().min(12, "ADMIN_PASSWORD en az 12 karakter olmalı"),
  CHECKIN_PASSWORD: z.string().min(8, "CHECKIN_PASSWORD en az 8 karakter olmalı"),
  /** E-postalardaki bağlantılar için sitenin kök adresi (sonda / olmadan). */
  SITE_URL: z.url().default("http://localhost:3000").transform((u) => u.replace(/\/+$/, "")),
  MAIL_MODE: z.enum(["console", "smtp"]).default("console"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("Beytepe Geyiği <noreply@example.com>"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Ortam değişkenleri hatalı (.env.example'a bakın):\n${issues}`);
  }
  if (parsed.data.MAIL_MODE === "smtp" && !parsed.data.SMTP_HOST) {
    throw new Error("MAIL_MODE=smtp iken SMTP_HOST zorunlu.");
  }
  cached = parsed.data;
  return cached;
}
