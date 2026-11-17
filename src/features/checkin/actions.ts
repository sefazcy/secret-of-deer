"use server";

import { db } from "@/lib/db";
import { parseTicketInput } from "@/lib/ticket";
import { requireStaff } from "@/features/admin/dal";
import { MISSING_SETTINGS_MESSAGE, PhaseError } from "@/features/event/phase";
import { checkInTicket, undoCheckInTicket } from "./service";

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

const CHECKIN_CLOSED = "Check-in yalnızca etkinlik günü (bilet modu) açıkken yapılabilir.";

function closedMessage(err: unknown): string {
  if (!(err instanceof PhaseError)) throw err;
  return err.reason === "missing_settings" ? MISSING_SETTINGS_MESSAGE : CHECKIN_CLOSED;
}

/** QR içeriği ya da elle girilen kodla girişi işaretler (faz kontrolü ve yazma atomik). */
export async function checkIn(input: string): Promise<CheckInResult> {
  await requireStaff("checkin");

  const code = parseTicketInput(String(input ?? ""));
  if (!code) return { status: "invalid", message: "Bu bir Beytepe Geyiği bileti değil ya da kod hatalı." };

  try {
    const out = await checkInTicket(db, code);
    if (out.status === "not_found") return { status: "not_found", code };
    return { status: out.status, person: toPerson(out.person) };
  } catch (err) {
    return { status: "closed", message: closedMessage(err) };
  }
}

/** Yanlışlıkla yapılan girişi geri alır. Yalnızca EVENT_DAY fazında (CLOSED vb. reddedilir). */
export async function undoCheckIn(code: string): Promise<{ ok: boolean; message?: string }> {
  await requireStaff("checkin");
  const parsed = parseTicketInput(String(code ?? ""));
  if (!parsed) return { ok: false, message: "Geçersiz bilet kodu." };
  try {
    return { ok: await undoCheckInTicket(db, parsed) };
  } catch (err) {
    return { ok: false, message: closedMessage(err) };
  }
}

export async function getCheckInStats(): Promise<{ checkedIn: number; total: number }> {
  await requireStaff("checkin");
  const [checkedIn, total] = await Promise.all([
    db.participantProfile.count({ where: { isCheckedIn: true } }),
    db.participantProfile.count(),
  ]);
  return { checkedIn, total };
}
