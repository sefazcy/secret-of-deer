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
const TAG_BYTES = 16;
/** RFC 5321: bir e-posta adresi en fazla 254 karakter. */
const MAX_EMAIL_BYTES = 254;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** Ayrıntı vermeyen tek hata: bozuk/manipüle girdi hakkında saldırgana ipucu sızmasın. */
export class EncryptedEmailError extends Error {
  constructor() {
    super("Şifreli e-posta çözülemedi.");
    this.name = "EncryptedEmailError";
  }
}

function encryptionKey(): Buffer {
  return Buffer.from(env().EMAIL_ENCRYPTION_KEY, "hex");
}

/** Çıktı biçimi: "iv.tag.ciphertext" (base64url). */
export function encryptEmail(email: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(normalizeEmail(email), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(".");
}

/** Kanonik base64url parçasını, beklenen uzunluk aralığındaysa çözer; değilse null. */
function decodePart(part: string | undefined, minBytes: number, maxBytes: number): Buffer | null {
  if (!part || !BASE64URL.test(part)) return null;
  const buf = Buffer.from(part, "base64url");
  // Node base64 çözücüsü hatalı karakterleri sessizce atlar; geri kodlayıp birebir karşılaştır.
  if (buf.toString("base64url") !== part) return null;
  if (buf.length < minBytes || buf.length > maxBytes) return null;
  return buf;
}

/**
 * Şifreli e-postayı çözer. Önce yapıyı sıkı doğrular (tam 3 parça, kanonik base64url,
 * 12 bayt IV, 16 bayt etiket, 1–254 bayt şifreli metin); ardından GCM bütünlük kontrolü.
 * Her türlü hata aynı `EncryptedEmailError` ile döner.
 */
export function decryptEmail(payload: string): string {
  if (typeof payload !== "string" || payload.length > 1024) throw new EncryptedEmailError();
  const parts = payload.split(".");
  if (parts.length !== 3) throw new EncryptedEmailError();

  const iv = decodePart(parts[0], IV_BYTES, IV_BYTES);
  const tag = decodePart(parts[1], TAG_BYTES, TAG_BYTES);
  const ciphertext = decodePart(parts[2], 1, MAX_EMAIL_BYTES);
  if (!iv || !tag || !ciphertext) throw new EncryptedEmailError();

  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv, { authTagLength: TAG_BYTES });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new EncryptedEmailError();
  }
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
