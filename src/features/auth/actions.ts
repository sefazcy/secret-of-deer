"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { OTP } from "@/lib/constants";
import { sendOtpMail } from "@/lib/mail";
import { getSession } from "@/lib/session";
import {
  deriveIdentityRef,
  encryptEmail,
  generateOtp,
  generateProfileToken,
  hashEmail,
  hashOtp,
  safeEqual,
} from "@/lib/crypto";
import { requestOtpSchema, verifyOtpSchema } from "./schemas";

type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type RequestOtpResult =
  | { ok: true; email: string; resendAvailableAt: number; devMode: boolean }
  | {
      ok: false;
      message: string;
      fieldErrors?: FieldErrors<"email" | "kvkk" | "pledge">;
      /** Bekleme süresi dolmadan yeniden istendiyse: tekrar gönderilebileceği an (ms). */
      resendAvailableAt?: number;
    };

export type VerifyOtpResult = { ok: false; message: string; attemptsLeft?: number; expired?: boolean };

function firstErrors<K extends string>(error: z.ZodError): FieldErrors<K> {
  const out: FieldErrors<K> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as K | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * 1. adım: e-postaya 6 haneli kod gönder.
 * Aynı yanıt hem yeni hem kayıtlı adresler için döner (adres var mı yok mu sızdırılmaz).
 */
export async function requestOtp(input: { email: string; kvkk: boolean; pledge: boolean }): Promise<RequestOtpResult> {
  const parsed = requestOtpSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = firstErrors<"email" | "kvkk" | "pledge">(parsed.error);
    return { ok: false, message: Object.values(fieldErrors)[0] ?? "Bilgileri kontrol et.", fieldErrors };
  }
  const { email } = parsed.data;

  const settings = await db.eventSettings.findUnique({ where: { id: 1 }, select: { phase: true } });
  if (settings?.phase === "CLOSED") {
    return { ok: false, message: "Etkinlik sona erdi, yeni giriş yapılamıyor. Görüşmek üzere! 🎄" };
  }

  const emailHash = hashEmail(email);
  const existing = await db.authIdentity.findUnique({
    where: { emailHash },
    select: { id: true, otpLastSentAt: true },
  });

  // Kayıtlar kapandıysa sadece önceden kayıtlı olanlar giriş yapabilir.
  if (!existing && settings && settings.phase !== "REGISTRATION") {
    return { ok: false, message: "Kayıtlar kapandı. Önceden kayıt olduysan aynı adresle giriş yapabilirsin." };
  }

  const now = Date.now();
  if (existing?.otpLastSentAt) {
    const resendAvailableAt = existing.otpLastSentAt.getTime() + OTP.resendSeconds * 1000;
    if (now < resendAvailableAt) {
      const wait = Math.ceil((resendAvailableAt - now) / 1000);
      return { ok: false, message: `Yeni kod için ${wait} saniye beklemelisin.`, resendAvailableAt };
    }
  }

  const code = generateOtp();
  const sentAt = new Date(now);
  const consent = { kvkkAcceptedAt: sentAt, pledgeAcceptedAt: sentAt };
  const otpFields = (identityId: string) => ({
    otpHash: hashOtp(identityId, code),
    otpExpiresAt: new Date(now + OTP.ttlMinutes * 60_000),
    otpAttempts: 0,
    otpLastSentAt: sentAt,
  });

  if (existing) {
    await db.authIdentity.update({ where: { id: existing.id }, data: { ...otpFields(existing.id), ...consent } });
  } else {
    // OTP özeti kimliğin id'sine bağlı olduğu için id'yi önceden üretiyoruz.
    const id = crypto.randomUUID();
    await db.authIdentity.create({
      data: {
        id,
        emailHash,
        encryptedEmail: encryptEmail(email),
        profileToken: generateProfileToken(),
        ...otpFields(id),
        ...consent,
      },
    });
  }

  try {
    await sendOtpMail(email, code);
  } catch (err) {
    console.error("[otp] e-posta gönderilemedi", err);
    // Bekleme süresini sıfırla ki kullanıcı hemen tekrar deneyebilsin.
    await db.authIdentity.update({ where: { emailHash }, data: { otpLastSentAt: null } });
    return { ok: false, message: "Kodu gönderemedik. Birkaç dakika sonra tekrar dener misin?" };
  }

  return {
    ok: true,
    email,
    resendAvailableAt: now + OTP.resendSeconds * 1000,
    devMode: env().MAIL_MODE === "console",
  };
}

const INVALID_CODE = "Kod hatalı ya da süresi dolmuş.";

/**
 * 2. adım: kodu doğrula, oturumu aç ve yönlendir.
 * Başarılı olursa redirect() fırlatır; yalnızca hata durumunda değer döner.
 */
export async function verifyOtp(input: { email: string; code: string }): Promise<VerifyOtpResult> {
  const parsed = verifyOtpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? INVALID_CODE };
  }
  const { email, code } = parsed.data;

  const identity = await db.authIdentity.findUnique({
    where: { emailHash: hashEmail(email) },
    select: { id: true, otpHash: true, otpExpiresAt: true, profileToken: true },
  });

  if (!identity?.otpHash || !identity.otpExpiresAt) {
    return { ok: false, message: INVALID_CODE, expired: true };
  }
  if (identity.otpExpiresAt.getTime() < Date.now()) {
    return { ok: false, message: "Kodun süresi doldu. Yeni bir kod iste.", expired: true };
  }

  // Deneme hakkını kontrol etmeden ÖNCE atomik olarak düş: paralel isteklerle limit aşılamaz.
  const consumed = await db.authIdentity.updateMany({
    where: { id: identity.id, otpHash: identity.otpHash, otpAttempts: { lt: OTP.maxAttempts } },
    data: { otpAttempts: { increment: 1 } },
  });
  if (consumed.count === 0) {
    return { ok: false, message: "Çok fazla hatalı deneme yaptın. Yeni bir kod iste.", expired: true };
  }

  if (!safeEqual(hashOtp(identity.id, code), identity.otpHash)) {
    const after = await db.authIdentity.findUnique({ where: { id: identity.id }, select: { otpAttempts: true } });
    const attemptsLeft = Math.max(0, OTP.maxAttempts - (after?.otpAttempts ?? OTP.maxAttempts));
    return attemptsLeft > 0
      ? { ok: false, message: `Kod hatalı. ${attemptsLeft} deneme hakkın kaldı.`, attemptsLeft }
      : { ok: false, message: "Kod hatalı ve deneme hakkın bitti. Yeni bir kod iste.", attemptsLeft: 0, expired: true };
  }

  // Tek kullanımlık: kodu yalnızca hâlâ aynı kodsa tüket (aynı anda iki başarılı giriş olmaz).
  const used = await db.authIdentity.updateMany({
    where: { id: identity.id, otpHash: identity.otpHash },
    data: { otpHash: null, otpExpiresAt: null, otpAttempts: 0, isVerified: true },
  });
  if (used.count === 0) return { ok: false, message: INVALID_CODE, expired: true };

  const session = await getSession();
  session.identityId = identity.id;
  await session.save();

  const profile = await db.participantProfile.findUnique({
    where: { identityRef: deriveIdentityRef(identity.profileToken) },
    select: { id: true },
  });

  redirect(profile ? "/panel" : "/profil-olustur");
}

export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/");
}
