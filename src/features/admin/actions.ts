"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { decryptEmail, deriveIdentityRef } from "@/lib/crypto";
import { safeErrorSummary } from "@/lib/log";
import { sendMatchReadyMail } from "@/lib/mail";
import { RateLimiter, formatRetryAfter } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";
import { bindSessionEpoch, getSession, getSessionEpoch, type StaffRole } from "@/lib/session";
import { BUDGET_TIER_KEYS, type BudgetTierKey } from "@/lib/constants";
import { MISSING_SETTINGS_MESSAGE, PhaseError } from "@/features/event/phase";
import { EVENT_SETTINGS_TAG, PARTICIPANT_COUNT_TAG } from "@/features/event/queries";
import { finalizeMatching, simulateMatching, type MatchingSummary } from "@/features/matching/service";
import { requireStaff } from "./dal";
import { isPurgeConfirmed } from "./purge-confirmation";
import { addJokerRecord, purgeAllRecords, removeJokerRecord, startEventDayRecord } from "./service";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

/** `PhaseError`'ı kullanıcıya gösterilecek sonuca çevirir; başka hataları yeniden fırlatır. */
function phaseFailure(err: unknown, wrongPhaseMessage: string): { ok: false; message: string } {
  if (!(err instanceof PhaseError)) throw err;
  return { ok: false, message: err.reason === "missing_settings" ? MISSING_SETTINGS_MESSAGE : wrongPhaseMessage };
}

function invalidatePublicCaches() {
  updateTag(EVENT_SETTINGS_TAG);
  updateTag(PARTICIPANT_COUNT_TAG);
}

// ── Ekip girişi ──────────────────────────────────────────────

// IP başına 15 dakikada en fazla 10 deneme.
const loginLimiter = new RateLimiter({ name: "staff-login-ip", limit: 10, windowMs: 15 * 60_000 });

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Uzunluk farkı sızdırmadan sabit zamanlı karşılaştırma. */
function passwordMatches(input: string, expected: string): boolean {
  return timingSafeEqual(sha256(input), sha256(expected));
}

export async function staffLogin(password: string): Promise<ActionResult> {
  const ip = await getClientIp();
  const limit = await loginLimiter.consume(ip);
  if (!limit.allowed) {
    return { ok: false, message: `Çok fazla deneme. ${formatRetryAfter(limit.retryAfterSeconds)} sonra tekrar dene.` };
  }

  const e = env();
  let role: StaffRole | null = null;
  // İki karşılaştırma da her zaman yapılır (hangi şifrenin denendiği zamanlamadan anlaşılmasın).
  const isAdmin = passwordMatches(password, e.ADMIN_PASSWORD);
  const isCheckin = passwordMatches(password, e.CHECKIN_PASSWORD);
  if (isAdmin) role = "admin";
  else if (isCheckin) role = "checkin";

  if (!role) return { ok: false, message: "Şifre hatalı." };

  const epoch = await getSessionEpoch();
  if (epoch === null) return { ok: false, message: MISSING_SETTINGS_MESSAGE };

  await loginLimiter.reset(ip);
  const session = await getSession();
  bindSessionEpoch(session, epoch);
  session.staffRole = role;
  await session.save();
  redirect(role === "admin" ? "/admin" : "/admin/check-in");
}

export async function staffLogout(): Promise<void> {
  const session = await getSession();
  delete session.staffRole;
  if (session.identityId) await session.save();
  else session.destroy();
  redirect("/admin/giris");
}

// ── Eşleştirme ───────────────────────────────────────────────

export type SimulateResult = { ok: true; summary: MatchingSummary } | { ok: false; message: string };

export async function simulateMatchingAction(): Promise<SimulateResult> {
  await requireStaff("admin");
  try {
    return { ok: true, summary: await simulateMatching(db) };
  } catch (err) {
    return phaseFailure(err, "Simülasyon yalnızca kayıt fazında yapılabilir.");
  }
}

export type FinalizeResult =
  | { ok: true; message: string; summary: MatchingSummary; sent: number; failed: number }
  | { ok: false; message: string; summary?: MatchingSummary };

/**
 * Eşleşmeleri kesinleştirir (faz kilidi + yazma + koşullu faz geçişi tek transaction'da),
 * ardından profili olan herkese duyuru e-postası atar.
 */
export async function finalizeAndNotify(): Promise<FinalizeResult> {
  await requireStaff("admin");

  let summary: MatchingSummary;
  try {
    summary = await finalizeMatching(db);
  } catch (err) {
    return phaseFailure(err, "Eşleştirme yalnızca kayıt fazında kesinleştirilebilir.");
  }
  if (!summary.isValid) {
    return { ok: false, message: "Eşleştirme geçersiz; uyarıları giderip tekrar deneyin.", summary };
  }

  // Bildirim: profili olan doğrulanmış kimlikler. Eşleşme ayrıntısı e-postada yok.
  const [identities, profileRefs] = await Promise.all([
    db.authIdentity.findMany({ where: { isVerified: true }, select: { encryptedEmail: true, profileToken: true } }),
    db.participantProfile.findMany({ where: { identityRef: { not: null } }, select: { identityRef: true } }),
  ]);
  const refs = new Set(profileRefs.map((p) => p.identityRef));
  const siteUrl = env().SITE_URL;
  let sent = 0;
  let failed = 0;
  for (const identity of identities) {
    if (!refs.has(deriveIdentityRef(identity.profileToken))) continue;
    try {
      await sendMatchReadyMail(decryptEmail(identity.encryptedEmail), siteUrl);
      sent++;
    } catch (err) {
      failed++;
      // Yalnızca hata türü: SMTP hata mesajı alıcı adresini içerebilir.
      console.error(`[bildirim] e-posta gönderilemedi (${safeErrorSummary(err)})`);
    }
  }

  invalidatePublicCaches();
  refresh();
  return {
    ok: true,
    message: `Eşleşmeler kesinleşti. ${sent} kişiye bildirim gönderildi${failed ? `, ${failed} gönderim başarısız` : ""}.`,
    summary,
    sent,
    failed,
  };
}

/** Faz 3'e geçiş (koşullu: yalnızca MATCHED → EVENT_DAY). Öğrenci panellerinde QR bilet görünür. */
export async function startEventDay(): Promise<ActionResult> {
  await requireStaff("admin");
  try {
    await startEventDayRecord(db);
  } catch (err) {
    return phaseFailure(err, "Bilet modu yalnızca eşleşmeler kesinleştikten sonra açılabilir.");
  }
  invalidatePublicCaches();
  refresh();
  return { ok: true, message: "Bilet modu açıldı. Öğrenciler panelde QR biletlerini görüyor." };
}

// ── Joker ────────────────────────────────────────────────────

export async function addJoker(tier: BudgetTierKey): Promise<ActionResult> {
  await requireStaff("admin");
  if (!BUDGET_TIER_KEYS.includes(tier)) return { ok: false, message: "Geçersiz bütçe grubu." };
  let alias: string;
  try {
    alias = await addJokerRecord(db, tier);
  } catch (err) {
    return phaseFailure(err, "Joker yalnızca eşleştirmeden önce eklenebilir.");
  }
  refresh();
  return { ok: true, message: `${alias} eklendi.` };
}

export async function removeJoker(profileId: string): Promise<ActionResult> {
  await requireStaff("admin");
  if (typeof profileId !== "string" || profileId.length > 64) return { ok: false, message: "Joker bulunamadı." };
  let removed: boolean;
  try {
    removed = await removeJokerRecord(db, profileId);
  } catch (err) {
    return phaseFailure(err, "Eşleştirmeden sonra joker kaldırılamaz.");
  }
  refresh();
  return removed ? { ok: true, message: "Joker kaldırıldı." } : { ok: false, message: "Joker bulunamadı." };
}

// ── Etkinliği sonlandır ve verileri imha et ──────────────────

export async function purgeAllData(confirmation: string): Promise<ActionResult> {
  await requireStaff("admin");
  if (!isPurgeConfirmed(confirmation)) {
    return { ok: false, message: "Onay ifadesi eşleşmedi; hiçbir veri silinmedi." };
  }

  let counts;
  try {
    counts = await purgeAllRecords(db);
  } catch (err) {
    return phaseFailure(err, "İmha yapılamadı.");
  }

  // PostgreSQL'de silinen satırlar (ölü tuple'lar) tablo dosyalarında kalır; VACUUM FULL tabloları
  // yeniden yazarak bu izleri fiziksel olarak temizler. Transaction dışında çalışmalı.
  try {
    await db.$executeRawUnsafe(
      'VACUUM FULL "auth_identities", "participant_profiles", "profile_interests", "matches"',
    );
  } catch (err) {
    console.error(`[imha] VACUUM çalıştırılamadı (${safeErrorSummary(err)})`);
  }

  // Oturum dönemi arttı: bu yöneticininki dahil imhadan önce açılmış tüm oturumlar artık geçersiz.
  invalidatePublicCaches();
  refresh();
  return {
    ok: true,
    message: `Etkinlik sonlandırıldı. ${counts.identities} kimlik, ${counts.profiles} profil, ${counts.interests} ilgi alanı ve ${counts.matches} eşleşme kalıcı olarak silindi. Tüm oturumlar kapatıldı.`,
  };
}
