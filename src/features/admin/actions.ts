"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { refresh, updateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { decryptEmail, deriveIdentityRef } from "@/lib/crypto";
import { sendMatchReadyMail } from "@/lib/mail";
import { RateLimiter } from "@/lib/rate-limit";
import { getSession, type StaffRole } from "@/lib/session";
import { generateTicketCode } from "@/lib/ticket";
import { BUDGET_TIER_KEYS, type BudgetTierKey } from "@/lib/constants";
import { EVENT_SETTINGS_TAG, PARTICIPANT_COUNT_TAG } from "@/features/event/queries";
import { finalizeMatching, simulateMatching, type MatchingSummary } from "@/features/matching/service";
import { aliasKey } from "@/features/profile/alias";
import { requireStaff } from "./dal";
import { pickJokerInterests } from "./joker";
import { isPurgeConfirmed } from "./purge-confirmation";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

async function currentPhase() {
  const s = await db.eventSettings.findUnique({ where: { id: 1 }, select: { phase: true } });
  return s?.phase ?? "REGISTRATION";
}

function invalidatePublicCaches() {
  updateTag(EVENT_SETTINGS_TAG);
  updateTag(PARTICIPANT_COUNT_TAG);
}

// ── Ekip girişi ──────────────────────────────────────────────

// IP başına 15 dakikada en fazla 10 deneme.
const loginLimiter = new RateLimiter(10, 15 * 60_000);

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Uzunluk farkı sızdırmadan sabit zamanlı karşılaştırma. */
function passwordMatches(input: string, expected: string): boolean {
  return timingSafeEqual(sha256(input), sha256(expected));
}

export async function staffLogin(password: string): Promise<ActionResult> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const limit = loginLimiter.consume(ip);
  if (!limit.allowed) {
    return { ok: false, message: `Çok fazla deneme. ${Math.ceil(limit.retryAfterSeconds / 60)} dakika sonra tekrar dene.` };
  }

  const e = env();
  let role: StaffRole | null = null;
  // İki karşılaştırma da her zaman yapılır (hangi şifrenin denendiği zamanlamadan anlaşılmasın).
  const isAdmin = passwordMatches(password, e.ADMIN_PASSWORD);
  const isCheckin = passwordMatches(password, e.CHECKIN_PASSWORD);
  if (isAdmin) role = "admin";
  else if (isCheckin) role = "checkin";

  if (!role) return { ok: false, message: "Şifre hatalı." };

  loginLimiter.reset(ip);
  const session = await getSession();
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

export async function simulateMatchingAction(): Promise<MatchingSummary> {
  await requireStaff("admin");
  return simulateMatching(db);
}

export type FinalizeResult =
  | { ok: true; message: string; summary: MatchingSummary; sent: number; failed: number }
  | { ok: false; message: string; summary?: MatchingSummary };

/** Eşleşmeleri kesinleştirir, fazı MATCHED yapar ve profili olan herkese duyuru e-postası atar. */
export async function finalizeAndNotify(): Promise<FinalizeResult> {
  await requireStaff("admin");
  if ((await currentPhase()) !== "REGISTRATION") {
    return { ok: false, message: "Eşleştirme yalnızca kayıt fazında kesinleştirilebilir." };
  }

  const summary = await finalizeMatching(db);
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
      console.error("[bildirim] e-posta gönderilemedi", err);
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

/** Faz 3'e geçiş: öğrenci panellerinde QR bilet görünür. */
export async function startEventDay(): Promise<ActionResult> {
  await requireStaff("admin");
  if ((await currentPhase()) !== "MATCHED") {
    return { ok: false, message: "Bilet modu yalnızca eşleşmeler kesinleştikten sonra açılabilir." };
  }
  await db.eventSettings.update({ where: { id: 1 }, data: { phase: "EVENT_DAY" } });
  invalidatePublicCaches();
  refresh();
  return { ok: true, message: "Bilet modu açıldı. Öğrenciler panelde QR biletlerini görüyor." };
}

// ── Joker ────────────────────────────────────────────────────

export async function addJoker(tier: BudgetTierKey): Promise<ActionResult> {
  await requireStaff("admin");
  if (!BUDGET_TIER_KEYS.includes(tier)) return { ok: false, message: "Geçersiz bütçe grubu." };
  if ((await currentPhase()) !== "REGISTRATION") {
    return { ok: false, message: "Joker yalnızca eşleştirmeden önce eklenebilir." };
  }

  const group = await db.participantProfile.findMany({
    where: { budgetTier: tier },
    select: { interests: { select: { interestSlug: true } } },
  });
  const interests = pickJokerInterests(group.map((p) => p.interests.map((i) => i.interestSlug)));
  if (interests.length < 3) interests.push(...["kitap", "kahve", "muzik"].filter((s) => !interests.includes(s)));

  // "Joker Geyik 1", "Joker Geyik 2"… boşta olan ilk numara.
  let n = 1;
  while (await db.participantProfile.findUnique({ where: { aliasKey: aliasKey(`Joker Geyik ${n}`) } })) n++;
  const alias = `Joker Geyik ${n}`;

  await db.participantProfile.create({
    data: {
      alias,
      aliasKey: aliasKey(alias),
      avatarId: "geyik",
      budgetTier: tier,
      isJoker: true,
      giftHints: "Organizasyon ekibinden gönüllü joker 🦌",
      ticketCode: generateTicketCode(),
      interests: { create: interests.slice(0, 7).map((interestSlug) => ({ interestSlug })) },
    },
  });
  refresh();
  return { ok: true, message: `${alias} eklendi.` };
}

export async function removeJoker(profileId: string): Promise<ActionResult> {
  await requireStaff("admin");
  if ((await currentPhase()) !== "REGISTRATION") {
    return { ok: false, message: "Eşleştirmeden sonra joker kaldırılamaz." };
  }
  const { count } = await db.participantProfile.deleteMany({ where: { id: profileId, isJoker: true } });
  refresh();
  return count ? { ok: true, message: "Joker kaldırıldı." } : { ok: false, message: "Joker bulunamadı." };
}

// ── Etkinliği sonlandır ve verileri imha et ──────────────────

export async function purgeAllData(confirmation: string): Promise<ActionResult> {
  await requireStaff("admin");
  if (!isPurgeConfirmed(confirmation)) {
    return { ok: false, message: "Onay ifadesi eşleşmedi; hiçbir veri silinmedi." };
  }

  const [matches, interests, profiles, identities] = await db.$transaction([
    db.match.deleteMany(),
    db.profileInterest.deleteMany(),
    db.participantProfile.deleteMany(),
    db.authIdentity.deleteMany(),
    db.eventSettings.update({ where: { id: 1 }, data: { phase: "CLOSED", dataPurgedAt: new Date() } }),
  ]);

  // Silinen satırlar veritabanı dosyasının boş sayfalarında kalabilir; VACUUM dosyayı yeniden yazar.
  // (SQLite ve PostgreSQL'de aynı komut; transaction dışında çalışmalı.)
  try {
    await db.$executeRawUnsafe("VACUUM");
  } catch (err) {
    console.error("[imha] VACUUM çalıştırılamadı", err);
  }

  invalidatePublicCaches();
  refresh();
  return {
    ok: true,
    message: `Etkinlik sonlandırıldı. ${identities.count} kimlik, ${profiles.count} profil, ${interests.count} ilgi alanı ve ${matches.count} eşleşme kalıcı olarak silindi.`,
  };
}
