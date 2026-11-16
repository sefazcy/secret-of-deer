"use server";

import { db } from "@/lib/db";
import { parseTicketInput } from "@/lib/ticket";
import { requireStaff } from "@/features/admin/dal";

export type CheckInPerson = {
  code: string;
  alias: string;
  avatarId: string;
  isGiftReady: boolean;
  isJoker: boolean;
  checkedInAt: string | null;
};

export type CheckInResult =
  | { status: "ok"; person: CheckInPerson }
  | { status: "already"; person: CheckInPerson }
  | { status: "invalid"; message: string }
  | { status: "not_found"; code: string }
  | { status: "closed"; message: string };

const personSelect = {
  ticketCode: true,
  alias: true,
  avatarId: true,
  isGiftReady: true,
  isJoker: true,
  checkedInAt: true,
} as const;

function toPerson(p: {
  ticketCode: string;
  alias: string;
  avatarId: string;
  isGiftReady: boolean;
  isJoker: boolean;
  checkedInAt: Date | null;
}): CheckInPerson {
  return {
    code: p.ticketCode,
    alias: p.alias,
    avatarId: p.avatarId,
    isGiftReady: p.isGiftReady,
    isJoker: p.isJoker,
    checkedInAt: p.checkedInAt?.toISOString() ?? null,
  };
}

/** QR içeriği ya da elle girilen kodla girişi işaretler. */
export async function checkIn(input: string): Promise<CheckInResult> {
  await requireStaff("checkin");

  const settings = await db.eventSettings.findUnique({ where: { id: 1 }, select: { phase: true } });
  if (settings?.phase !== "EVENT_DAY") {
    return { status: "closed", message: "Check-in yalnızca etkinlik günü (bilet modu) açıkken yapılabilir." };
  }

  const code = parseTicketInput(input);
  if (!code) return { status: "invalid", message: "Bu bir Beytepe Geyiği bileti değil ya da kod hatalı." };

  // Atomik: yalnızca henüz giriş yapmamışsa işaretle. Aynı anda iki okutmada biri "already" alır.
  const now = new Date();
  const { count } = await db.participantProfile.updateMany({
    where: { ticketCode: code, isCheckedIn: false },
    data: { isCheckedIn: true, checkedInAt: now },
  });

  const profile = await db.participantProfile.findUnique({ where: { ticketCode: code }, select: personSelect });
  if (!profile) return { status: "not_found", code };
  return { status: count === 1 ? "ok" : "already", person: toPerson(profile) };
}

/** Yanlışlıkla yapılan girişi geri alır. */
export async function undoCheckIn(code: string): Promise<{ ok: boolean }> {
  await requireStaff("checkin");
  const parsed = parseTicketInput(code);
  if (!parsed) return { ok: false };
  const { count } = await db.participantProfile.updateMany({
    where: { ticketCode: parsed, isCheckedIn: true },
    data: { isCheckedIn: false, checkedInAt: null },
  });
  return { ok: count === 1 };
}

export async function getCheckInStats(): Promise<{ checkedIn: number; total: number }> {
  await requireStaff("checkin");
  const [checkedIn, total] = await Promise.all([
    db.participantProfile.count({ where: { isCheckedIn: true } }),
    db.participantProfile.count(),
  ]);
  return { checkedIn, total };
}
