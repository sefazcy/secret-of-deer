import { z } from "zod";

/**
 * Ortam değişkeni şeması ve çapraz kurallar. `server-only` DEĞİL: hem `instrumentation.ts`
 * (sunucu başlarken) hem de birim testleri tarafından doğrudan çağrılabilsin diye ayrı modül.
 * Uygulama kodu bunun yerine `@/lib/env` içindeki `env()`'i kullanmalı.
 */

/** .env'de `KEY=""` boş bırakılan alanlar "girilmemiş" sayılır. */
const optionalString = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL zorunlu"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET en az 32 karakter olmalı"),
  EMAIL_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "EMAIL_ENCRYPTION_KEY 64 karakterlik hex olmalı (32 bayt)"),
  EMAIL_HASH_PEPPER: z.string().min(32, "EMAIL_HASH_PEPPER en az 32 karakter olmalı"),
  PROFILE_LINK_SECRET: z.string().min(32, "PROFILE_LINK_SECRET en az 32 karakter olmalı"),
  ADMIN_PASSWORD: z.string().min(12, "ADMIN_PASSWORD en az 12 karakter olmalı"),
  CHECKIN_PASSWORD: z.string().min(10, "CHECKIN_PASSWORD en az 10 karakter olmalı"),
  /** E-postalardaki bağlantılar için sitenin kök adresi (sonda / olmadan). */
  SITE_URL: z.url().default("http://localhost:3000").transform((u) => u.replace(/\/+$/, "")),
  MAIL_MODE: z.enum(["console", "smtp"]).default("console"),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  MAIL_FROM: z.string().default("Beytepe Geyiği <noreply@example.com>"),
});

export type Env = z.infer<typeof envSchema>;

// ── Entropi kuralları ────────────────────────────────────────

/**
 * Kaba entropi tahmini (bit): uzunluk × log2(kullanılan karakter sınıflarının havuzu).
 * Rastgele üretilmiş anahtarlar için üst sınırdır; asıl amaç "aaaa…" ya da "12345678…"
 * gibi açıkça zayıf değerleri yakalamak (bu yüzden farklı karakter sayısı da ayrıca denetlenir).
 */
export function estimateEntropyBits(value: string): number {
  let pool = 0;
  if (/[a-z]/.test(value)) pool += 26;
  if (/[A-Z]/.test(value)) pool += 26;
  if (/[0-9]/.test(value)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(value)) pool += 33;
  return pool === 0 ? 0 : value.length * Math.log2(pool);
}

function distinctChars(value: string): number {
  return new Set(value).size;
}

type StrengthRule = { minBits: number; minDistinct: number };

/** Rastgele üretilen anahtarlar (npm run secrets) bu sınırları rahatça geçer. */
const SECRET_RULES: Record<string, StrengthRule> = {
  SESSION_SECRET: { minBits: 160, minDistinct: 12 },
  EMAIL_ENCRYPTION_KEY: { minBits: 200, minDistinct: 10 },
  EMAIL_HASH_PEPPER: { minBits: 160, minDistinct: 12 },
  PROFILE_LINK_SECRET: { minBits: 160, minDistinct: 12 },
  ADMIN_PASSWORD: { minBits: 64, minDistinct: 8 },
  CHECKIN_PASSWORD: { minBits: 50, minDistinct: 6 },
};

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

/**
 * Şemadan geçmiş yapılandırmaya çapraz kuralları uygular; hata mesajlarını döndürür.
 * Mesajlarda değerin kendisi ASLA yer almaz, yalnızca değişken adı.
 */
export function crossCheckEnv(e: Env): string[] {
  const issues: string[] = [];
  const isProd = e.NODE_ENV === "production";

  // 1) Anahtar/şifre gücü
  for (const [key, rule] of Object.entries(SECRET_RULES)) {
    const value = e[key as keyof Env] as string;
    if (estimateEntropyBits(value) < rule.minBits || distinctChars(value) < rule.minDistinct) {
      issues.push(`${key}: çok zayıf (tahmin edilebilir). \`npm run secrets\` ile üretin ya da daha uzun/karmaşık bir değer seçin.`);
    }
  }

  // 2) Tüm sırlar birbirinden farklı olmalı (biri sızarsa diğerleri korunmalı).
  const secretKeys = Object.keys(SECRET_RULES) as (keyof Env)[];
  for (let i = 0; i < secretKeys.length; i++) {
    for (let j = i + 1; j < secretKeys.length; j++) {
      const a = String(e[secretKeys[i]!]).toLowerCase();
      const b = String(e[secretKeys[j]!]).toLowerCase();
      if (a === b) issues.push(`${secretKeys[i]} ve ${secretKeys[j]} aynı olamaz.`);
    }
  }

  // 3) SMTP kimlik bilgileri birlikte girilmeli.
  if (!!e.SMTP_USER !== !!e.SMTP_PASS) {
    issues.push("SMTP_USER ve SMTP_PASS birlikte girilmeli (biri boş, diğeri dolu).");
  }
  if (e.MAIL_MODE === "smtp" && !e.SMTP_HOST) {
    issues.push("MAIL_MODE=smtp iken SMTP_HOST zorunlu.");
  }

  // 4) Üretim kuralları
  if (isProd) {
    if (e.MAIL_MODE !== "smtp") {
      issues.push("Üretimde MAIL_MODE=console kullanılamaz (OTP kodları terminale yazılır). MAIL_MODE=smtp olmalı.");
    }
    if (!e.SMTP_HOST || !e.SMTP_USER || !e.SMTP_PASS) {
      issues.push("Üretimde SMTP_HOST, SMTP_USER ve SMTP_PASS zorunlu.");
    }
    if (/@example\.(com|org|net)\b/i.test(e.MAIL_FROM)) {
      issues.push("Üretimde MAIL_FROM gerçek bir gönderici adresi olmalı.");
    }
    let url: URL | null = null;
    try {
      url = new URL(e.SITE_URL);
    } catch {
      /* şema zaten doğruladı */
    }
    if (!url || url.protocol !== "https:" || LOCAL_HOSTS.has(url.hostname)) {
      issues.push("Üretimde SITE_URL https:// ile başlayan, localhost olmayan gerçek bir adres olmalı.");
    }
  }

  return issues;
}

export type EnvResult = { ok: true; env: Env } | { ok: false; issues: string[] };

/** Şema + çapraz kurallar. Yan etkisiz; testlerde istenen `source` ile çağrılabilir. */
export function parseEnv(source: Record<string, string | undefined>): EnvResult {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const issues = crossCheckEnv(parsed.data);
  return issues.length ? { ok: false, issues } : { ok: true, env: parsed.data };
}

export function formatEnvIssues(issues: string[]): string {
  return `Ortam değişkenleri hatalı (.env.example'a bakın):\n${issues.map((i) => `  • ${i}`).join("\n")}`;
}
