import type { PrismaClient } from "../../generated/prisma/client";
import { lockPhase } from "../event/phase";

/**
 * Kapı check-in işlemleri. İkisi de yalnızca `EVENT_DAY` fazında ve faz kilidi altında:
 * bilet modu kapatılırken / veriler imha edilirken araya giriş yazılamaz, `CLOSED` ya da
 * başka bir fazda geri alma sunucu tarafında kesin olarak reddedilir (`PhaseError`).
 */

const personSelect = {
  ticketCode: true,
  alias: true,
  avatarId: true,
  isGiftReady: true,
  isJoker: true,
  checkedInAt: true,
} as const;

export type CheckInRow = {
  ticketCode: string;
  alias: string;
  avatarId: string;
  isGiftReady: boolean;
  isJoker: boolean;
  checkedInAt: Date | null;
};

export type CheckInOutcome =
  | { status: "ok"; person: CheckInRow }
  | { status: "already"; person: CheckInRow }
  | { status: "not_found" };

/** `code` önceden `parseTicketInput` ile doğrulanmış olmalı. */
export async function checkInTicket(db: PrismaClient, code: string, now = new Date()): Promise<CheckInOutcome> {
  return db.$transaction(async (tx) => {
    await lockPhase(tx, ["EVENT_DAY"]);
    // Yalnızca henüz giriş yapmamışsa işaretle. Aynı anda iki okutmada biri "already" alır.
    const { count } = await tx.participantProfile.updateMany({
      where: { ticketCode: code, isCheckedIn: false },
      data: { isCheckedIn: true, checkedInAt: now },
    });
    const person = await tx.participantProfile.findUnique({ where: { ticketCode: code }, select: personSelect });
    if (!person) return { status: "not_found" as const };
    return { status: count === 1 ? ("ok" as const) : ("already" as const), person };
  });
}

/** Girişi geri alır; geri alındıysa true. Yalnızca EVENT_DAY. */
export async function undoCheckInTicket(db: PrismaClient, code: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    await lockPhase(tx, ["EVENT_DAY"]);
    const { count } = await tx.participantProfile.updateMany({
      where: { ticketCode: code, isCheckedIn: true },
      data: { isCheckedIn: false, checkedInAt: null },
    });
    return count === 1;
  });
}
