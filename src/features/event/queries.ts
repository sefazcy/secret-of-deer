import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";

export const EVENT_SETTINGS_TAG = "event-settings";
export const PARTICIPANT_COUNT_TAG = "participant-count";

export type PublicEventInfo = {
  phase: "REGISTRATION" | "MATCHED" | "EVENT_DAY" | "CLOSED";
  registrationClosesAt: string;
  eventStartsAt: string;
  location: string;
};

/** Herkese açık etkinlik bilgisi. Admin ayarları değiştirince `updateTag(EVENT_SETTINGS_TAG)` çağrılmalı. */
export async function getPublicEventInfo(): Promise<PublicEventInfo | null> {
  "use cache";
  cacheTag(EVENT_SETTINGS_TAG);
  cacheLife("minutes");

  const s = await db.eventSettings.findUnique({ where: { id: 1 } });
  if (!s) return null;
  return {
    phase: s.phase,
    registrationClosesAt: s.registrationClosesAt.toISOString(),
    eventStartsAt: s.eventStartsAt.toISOString(),
    location: s.location,
  };
}

/** Panel ve ana sayfadaki canlı katılımcı sayacı (jokerler hariç). */
export async function getParticipantCount(): Promise<number> {
  "use cache";
  cacheTag(PARTICIPANT_COUNT_TAG);
  cacheLife("seconds");

  return db.participantProfile.count({ where: { isJoker: false } });
}
