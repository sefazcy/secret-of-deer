import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { env } from "./env";

/** E-postayı karşılaştırma öncesi tek biçime getirir. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hmac(key: string, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

/**
 * Mükerrer kayıt kontrolü için e-posta özeti.
 * Düz SHA-256 yerine anahtarlı HMAC-SHA256: öğrenci e-postaları tahmin edilebilir
 * (numara@ogr.hacettepe.edu.tr) olduğundan anahtarsız özet sözlük saldırısıyla çözülebilirdi.
 */
export function hashEmail(email: string): string {
  return hmac(env().EMAIL_HASH_PEPPER, `email:${normalizeEmail(email)}`);
}

// ── AES-256-GCM ──────────────────────────────────────────────

const IV_BYTES = 12;

function encryptionKey(): Buffer {
  return Buffer.from(env().EMAIL_ENCRYPTION_KEY, "hex");
}

/** Çıktı biçimi: "iv.tag.ciphertext" (base64url). */
export function encryptEmail(email: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(normalizeEmail(email), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(".");
}

export function decryptEmail(payload: string): string {
  const [iv, tag, ciphertext] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !ciphertext) throw new Error("Şifreli e-posta biçimi geçersiz.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// ── OTP ──────────────────────────────────────────────────────

/** 6 haneli, kriptografik olarak rastgele kod. */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** OTP veritabanında düz değil, kimliğe bağlı HMAC özeti olarak saklanır. */
export function hashOtp(identityId: string, code: string): string {
  return hmac(env().EMAIL_HASH_PEPPER, `otp:${identityId}:${code}`);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// ── Kimlik ↔ profil köprüsü ──────────────────────────────────

export function generateProfileToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Profil tablosunda saklanan referans; sunucu sırrı olmadan token'dan türetilemez. */
export function deriveIdentityRef(profileToken: string): string {
  return hmac(env().PROFILE_LINK_SECRET, `profile:${profileToken}`);
}
