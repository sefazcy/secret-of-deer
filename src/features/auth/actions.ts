"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendOtpMail } from "@/lib/mail";
import { formatRetryAfter } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { bindSessionEpoch, getSession, getSessionEpoch } from "@/lib/session";
import { deriveIdentityRef } from "@/lib/crypto";
import { MISSING_SETTINGS_MESSAGE } from "@/features/event/phase";
import { otpLimiters, requestOtpCore, verifyOtpCore, type OtpDeps } from "./otp-service";
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

async function otpDeps(): Promise<OtpDeps> {
  return { db, ip: await getClientIp(), limiters: otpLimiters, sendOtp: sendOtpMail };
}

function tooMany(retryAfterSeconds: number) {
  return `Çok fazla deneme yapıldı. ${formatRetryAfter(retryAfterSeconds)} sonra tekrar dene.`;
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

  const out = await requestOtpCore(await otpDeps(), email);
  switch (out.status) {
    case "sent":
      return {
        ok: true,
        email,
        resendAvailableAt: out.resendAvailableAt,
        devMode: env().MAIL_MODE === "console" && process.env.NODE_ENV !== "production",
      };
    case "cooldown": {
      const wait = Math.max(1, Math.ceil((out.resendAvailableAt - Date.now()) / 1000));
      return { ok: false, message: `Yeni kod için ${wait} saniye beklemelisin.`, resendAvailableAt: out.resendAvailableAt };
    }
    case "rate_limited":
      return {
        ok: false,
        message:
          out.scope === "email"
            ? `Bu adrese bugün çok fazla kod gönderildi. ${formatRetryAfter(out.retryAfterSeconds)} sonra tekrar dene.`
            : tooMany(out.retryAfterSeconds),
      };
    case "missing_settings":
      return { ok: false, message: MISSING_SETTINGS_MESSAGE };
    case "event_closed":
      return { ok: false, message: "Etkinlik sona erdi, yeni giriş yapılamıyor. Görüşmek üzere! 🎄" };
    case "registration_closed":
      return { ok: false, message: "Kayıtlar kapandı. Önceden kayıt olduysan aynı adresle giriş yapabilirsin." };
    case "send_failed":
      return { ok: false, message: "Kodu gönderemedik. Birkaç dakika sonra tekrar dener misin?" };
  }
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

  const out = await verifyOtpCore(await otpDeps(), email, code);
  switch (out.status) {
    case "rate_limited":
      return { ok: false, message: tooMany(out.retryAfterSeconds) };
    case "missing_settings":
      return { ok: false, message: MISSING_SETTINGS_MESSAGE };
    case "event_closed":
      return { ok: false, message: "Etkinlik sona erdi, giriş yapılamıyor.", expired: true };
    case "invalid":
      return { ok: false, message: INVALID_CODE, expired: true };
    case "expired":
      return { ok: false, message: "Kodun süresi doldu. Yeni bir kod iste.", expired: true };
    case "too_many_attempts":
      return { ok: false, message: "Çok fazla hatalı deneme yaptın. Yeni bir kod iste.", expired: true };
    case "wrong_code":
      return out.attemptsLeft > 0
        ? { ok: false, message: `Kod hatalı. ${out.attemptsLeft} deneme hakkın kaldı.`, attemptsLeft: out.attemptsLeft }
        : { ok: false, message: "Kod hatalı ve deneme hakkın bitti. Yeni bir kod iste.", attemptsLeft: 0, expired: true };
    case "verified":
      break;
  }

  const epoch = await getSessionEpoch();
  if (epoch === null) return { ok: false, message: MISSING_SETTINGS_MESSAGE };

  const session = await getSession();
  bindSessionEpoch(session, epoch);
  session.identityId = out.identityId;
  await session.save();

  const profile = await db.participantProfile.findUnique({
    where: { identityRef: deriveIdentityRef(out.profileToken) },
    select: { id: true },
  });

  redirect(profile ? "/panel" : "/profil-olustur");
}

export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/");
}
