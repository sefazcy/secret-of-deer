import "server-only";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { OTP, OTP_RATE_LIMITS } from "../../lib/constants";
import { encryptEmail, generateOtp, generateProfileToken, hashEmail, hashOtp, safeEqual } from "../../lib/crypto";
import { safeErrorSummary } from "../../lib/log";
import { RateLimiter, consumeAll } from "../../lib/rate-limit";

/**
 * OTP iş mantığı (sunucu aksiyonlarından bağımsız; `db`, IP, saat ve e-posta gönderici
 * parametre olarak gelir → entegrasyon testlerinde doğrudan çağrılabilir).
 *
 * Hız sınırı katmanları:
 *   requestOtp: IP (15 dk / 10) → e-posta kimliği 60 sn bekleme (DB, atomik) → e-posta kimliği (24 sa / 5)
 *   verifyOtp : IP (15 dk / 30) → e-posta kimliği (1 sa / 15) → kod başına 5 yanlış deneme (DB, atomik)
 * E-posta kimliği anahtarı ham e-posta değil, HMAC özetidir.
 */

export type OtpLimiters = {
  requestByIp: RateLimiter;
  requestByEmail: RateLimiter;
  verifyByIp: RateLimiter;
  verifyByEmail: RateLimiter;
};

export function createOtpLimiters(overrides: Partial<Pick<ConstructorParameters<typeof RateLimiter>[0], "store" | "now">> = {}): OtpLimiters {
  const make = (name: string, cfg: { limit: number; windowMs: number }) => new RateLimiter({ name, ...cfg, ...overrides });
  return {
    requestByIp: make("otp-request-ip", OTP_RATE_LIMITS.requestPerIp),
    requestByEmail: make("otp-request-email", OTP_RATE_LIMITS.requestPerEmail),
    verifyByIp: make("otp-verify-ip", OTP_RATE_LIMITS.verifyPerIp),
    verifyByEmail: make("otp-verify-email", OTP_RATE_LIMITS.verifyPerEmail),
  };
}

/** Uygulamanın paylaşılan sınırlayıcıları (depo: `getRateLimitStore()`). */
export const otpLimiters = createOtpLimiters();

export type OtpDeps = {
  db: PrismaClient;
  ip: string;
  limiters: OtpLimiters;
  sendOtp: (email: string, code: string) => Promise<void>;
  now?: () => number;
};

export type RequestOtpOutcome =
  | { status: "sent"; resendAvailableAt: number }
  | { status: "rate_limited"; scope: "ip" | "email"; retryAfterSeconds: number }
  | { status: "cooldown"; resendAvailableAt: number }
  | { status: "missing_settings" }
  | { status: "event_closed" }
  | { status: "registration_closed" }
  | { status: "send_failed" };

/** `email` önceden şema ile doğrulanmış ve normalize edilmiş olmalı. */
export async function requestOtpCore(deps: OtpDeps, email: string): Promise<RequestOtpOutcome> {
  const { db, limiters } = deps;
  const now = (deps.now ?? Date.now)();

  // 1) IP katmanı: veritabanına dokunmadan önce.
  const ipBlock = await consumeAll([[limiters.requestByIp, deps.ip]]);
  if (ipBlock) return { status: "rate_limited", scope: "ip", retryAfterSeconds: ipBlock.result.retryAfterSeconds };

  // 2) Ayar satırı yoksa varsayılan faz VARSAYILMAZ.
  const settings = await db.eventSettings.findUnique({ where: { id: 1 }, select: { phase: true } });
  if (!settings) return { status: "missing_settings" };
  if (settings.phase === "CLOSED") return { status: "event_closed" };

  const emailHash = hashEmail(email);
  const existing = await db.authIdentity.findUnique({ where: { emailHash }, select: { id: true, otpLastSentAt: true } });

  // Kayıtlar kapandıysa sadece önceden kayıtlı olanlar giriş yapabilir.
  if (!existing && settings.phase !== "REGISTRATION") return { status: "registration_closed" };

  const cooldownMs = OTP.resendSeconds * 1000;
  // 3) Bekleme süresi içindeyse erken dön (kesin kontrol 4. adımda, atomik).
  if (existing?.otpLastSentAt && now < existing.otpLastSentAt.getTime() + cooldownMs) {
    return { status: "cooldown", resendAvailableAt: existing.otpLastSentAt.getTime() + cooldownMs };
  }

  // 4) Atomik gönderim hakkı: yalnızca son gönderim 60 sn'den eskiyse `otpLastSentAt` bizim olur.
  //    Aynı anda gelen isteklerden yalnızca biri kazanır, diğerleri "cooldown" alır ve
  //    günlük kotayı HARCAMAZ (kota yalnızca kazanan için düşülür).
  const sentAt = new Date(now);
  const cooldown = { status: "cooldown" as const, resendAvailableAt: now + cooldownMs };

  let identityId: string;
  let previousSentAt: Date | null = null;
  if (existing) {
    identityId = existing.id;
    previousSentAt = existing.otpLastSentAt;
    const { count } = await db.authIdentity.updateMany({
      where: {
        id: existing.id,
        OR: [{ otpLastSentAt: null }, { otpLastSentAt: { lte: new Date(now - cooldownMs) } }],
      },
      data: { otpLastSentAt: sentAt },
    });
    if (count === 0) return cooldown;
  } else {
    identityId = crypto.randomUUID();
    try {
      await db.authIdentity.create({
        data: {
          id: identityId,
          emailHash,
          encryptedEmail: encryptEmail(email),
          profileToken: generateProfileToken(),
          otpLastSentAt: sentAt,
        },
      });
    } catch (err) {
      // Aynı adres için eşzamanlı ilk istek: diğeri kimliği oluşturdu.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return cooldown;
      throw err;
    }
  }
  /** Gönderim hakkını geri ver (yalnızca hâlâ bizimse). */
  const releaseSlot = () =>
    db.authIdentity.updateMany({ where: { id: identityId, otpLastSentAt: sentAt }, data: { otpLastSentAt: previousSentAt } });

  // 5) E-posta kimliği katmanı: 24 saatte en fazla N kod.
  const emailBlock = await consumeAll([[limiters.requestByEmail, emailHash]]);
  if (emailBlock) {
    await releaseSlot();
    return { status: "rate_limited", scope: "email", retryAfterSeconds: emailBlock.result.retryAfterSeconds };
  }

  // 6) Kodu yaz (OTP özeti kimlik id'sine bağlı). Yalnızca gönderim hakkı hâlâ bizimse.
  const code = generateOtp();
  const { count: written } = await db.authIdentity.updateMany({
    where: { id: identityId, otpLastSentAt: sentAt },
    data: {
      otpHash: hashOtp(identityId, code),
      otpExpiresAt: new Date(now + OTP.ttlMinutes * 60_000),
      otpAttempts: 0,
      kvkkAcceptedAt: sentAt,
      pledgeAcceptedAt: sentAt,
    },
  });
  if (written === 0) return cooldown;

  try {
    await deps.sendOtp(email, code);
  } catch (err) {
    // Log'a yalnızca hata türü/kodu: SMTP hata mesajları alıcı adresini içerebilir.
    console.error(`[otp] e-posta gönderilemedi (${safeErrorSummary(err)})`);
    // Bekleme süresini sıfırla ki kullanıcı hemen tekrar deneyebilsin (yalnızca hâlâ bizim gönderimse).
    await db.authIdentity.updateMany({ where: { id: identityId, otpLastSentAt: sentAt }, data: { otpLastSentAt: null } });
    return { status: "send_failed" };
  }

  return { status: "sent", resendAvailableAt: now + cooldownMs };
}

export type VerifyOtpOutcome =
  | { status: "verified"; identityId: string; profileToken: string }
  | { status: "rate_limited"; scope: "ip" | "email"; retryAfterSeconds: number }
  | { status: "missing_settings" }
  | { status: "event_closed" }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "too_many_attempts" }
  | { status: "wrong_code"; attemptsLeft: number };

/** `email` ve `code` önceden şema ile doğrulanmış olmalı. */
export async function verifyOtpCore(deps: OtpDeps, email: string, code: string): Promise<VerifyOtpOutcome> {
  const { db, limiters } = deps;
  const now = (deps.now ?? Date.now)();
  const emailHash = hashEmail(email);

  const ipBlock = await consumeAll([[limiters.verifyByIp, deps.ip]]);
  if (ipBlock) return { status: "rate_limited", scope: "ip", retryAfterSeconds: ipBlock.result.retryAfterSeconds };
  // Hesap katmanı: yeni kod istenince sıfırlanan "kod başına 5 deneme"yi aşmaya yönelik
  // (kod iste → 5 dene → yeni kod iste …) tahmin saldırılarını sınırlar.
  const emailBlock = await consumeAll([[limiters.verifyByEmail, emailHash]]);
  if (emailBlock) {
    return { status: "rate_limited", scope: "email", retryAfterSeconds: emailBlock.result.retryAfterSeconds };
  }

  const settings = await db.eventSettings.findUnique({ where: { id: 1 }, select: { phase: true } });
  if (!settings) return { status: "missing_settings" };
  if (settings.phase === "CLOSED") return { status: "event_closed" };

  const identity = await db.authIdentity.findUnique({
    where: { emailHash },
    select: { id: true, otpHash: true, otpExpiresAt: true, profileToken: true },
  });
  if (!identity?.otpHash || !identity.otpExpiresAt) return { status: "invalid" };
  if (identity.otpExpiresAt.getTime() < now) return { status: "expired" };

  // Deneme hakkını kontrol etmeden ÖNCE atomik olarak düş: paralel isteklerle limit aşılamaz.
  const consumed = await db.authIdentity.updateMany({
    where: { id: identity.id, otpHash: identity.otpHash, otpAttempts: { lt: OTP.maxAttempts } },
    data: { otpAttempts: { increment: 1 } },
  });
  if (consumed.count === 0) return { status: "too_many_attempts" };

  if (!safeEqual(hashOtp(identity.id, code), identity.otpHash)) {
    const after = await db.authIdentity.findUnique({ where: { id: identity.id }, select: { otpAttempts: true } });
    const attemptsLeft = Math.max(0, OTP.maxAttempts - (after?.otpAttempts ?? OTP.maxAttempts));
    return { status: "wrong_code", attemptsLeft };
  }

  // Tek kullanımlık: kodu yalnızca hâlâ aynı kodsa tüket (aynı anda iki başarılı giriş olmaz).
  const used = await db.authIdentity.updateMany({
    where: { id: identity.id, otpHash: identity.otpHash },
    data: { otpHash: null, otpExpiresAt: null, otpAttempts: 0, isVerified: true },
  });
  if (used.count === 0) return { status: "invalid" };

  await limiters.verifyByEmail.reset(emailHash);
  return { status: "verified", identityId: identity.id, profileToken: identity.profileToken };
}
