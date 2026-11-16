import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { deriveIdentityRef } from "@/lib/crypto";
import { ticketQrPayload } from "@/lib/ticket";
import type { BudgetTierKey, InterestSlug } from "@/lib/constants";
import { getCurrentIdentity } from "@/features/auth/dal";

export type PublicProfile = {
  alias: string;
  avatarId: string;
  budgetTier: BudgetTierKey;
  interests: InterestSlug[];
  giftHints: string;
  giftExclusions: string;
};

export type PanelData = {
  phase: "REGISTRATION" | "MATCHED" | "EVENT_DAY" | "CLOSED";
  event: { registrationClosesAt: string; eventStartsAt: string; location: string };
  me: PublicProfile & { isGiftReady: boolean; isCheckedIn: boolean };
  /** Faz 2–3: hediye alacağın kişi (eşleşme yoksa null). */
  match: (PublicProfile & { commonInterests: InterestSlug[] }) | null;
  /** Yalnızca Faz 3'te dolu; daha önce istemciye gönderilmez. */
  ticket: { code: string; qrPayload: string } | null;
};

const profileSelect = {
  alias: true,
  avatarId: true,
  budgetTier: true,
  giftHints: true,
  giftExclusions: true,
  interests: { select: { interestSlug: true } },
} as const;

function toPublic(p: {
  alias: string;
  avatarId: string;
  budgetTier: string;
  giftHints: string;
  giftExclusions: string;
  interests: { interestSlug: string }[];
}): PublicProfile {
  return {
    alias: p.alias,
    avatarId: p.avatarId,
    budgetTier: p.budgetTier as BudgetTierKey,
    interests: p.interests.map((i) => i.interestSlug as InterestSlug),
    giftHints: p.giftHints,
    giftExclusions: p.giftExclusions,
  };
}

/**
 * Panelin ihtiyaç duyduğu her şey, tek yerden ve yalnızca gösterilecek alanlarla.
 * Giriş yoksa /kayit'a, profil yoksa /profil-olustur'a yönlendirir.
 */
export async function getPanelData(): Promise<PanelData> {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/kayit");

  const [profile, settings] = await Promise.all([
    db.participantProfile.findUnique({
      where: { identityRef: deriveIdentityRef(identity.profileToken) },
      select: {
        ...profileSelect,
        id: true,
        isGiftReady: true,
        isCheckedIn: true,
        ticketCode: true,
        givingMatch: { select: { receiver: { select: profileSelect } } },
      },
    }),
    db.eventSettings.findUnique({ where: { id: 1 } }),
  ]);
  if (!profile) redirect("/profil-olustur");
  if (!settings) throw new Error("Etkinlik ayarları bulunamadı. `npm run db:seed` çalıştırın.");

  const me = toPublic(profile);
  const showMatch = settings.phase === "MATCHED" || settings.phase === "EVENT_DAY";
  const receiver = showMatch && profile.givingMatch ? toPublic(profile.givingMatch.receiver) : null;

  return {
    phase: settings.phase,
    event: {
      registrationClosesAt: settings.registrationClosesAt.toISOString(),
      eventStartsAt: settings.eventStartsAt.toISOString(),
      location: settings.location,
    },
    me: { ...me, isGiftReady: profile.isGiftReady, isCheckedIn: profile.isCheckedIn },
    match: receiver && {
      ...receiver,
      commonInterests: receiver.interests.filter((i) => me.interests.includes(i)),
    },
    ticket:
      settings.phase === "EVENT_DAY"
        ? { code: profile.ticketCode, qrPayload: ticketQrPayload(profile.ticketCode) }
        : null,
  };
}

/** Düzenleme formunu doldurmak için mevcut profil (yalnızca kayıt fazında). */
export async function getEditableProfile(): Promise<PublicProfile | null> {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/kayit");
  const profile = await db.participantProfile.findUnique({
    where: { identityRef: deriveIdentityRef(identity.profileToken) },
    select: profileSelect,
  });
  if (!profile) redirect("/profil-olustur");
  return toPublic(profile);
}
