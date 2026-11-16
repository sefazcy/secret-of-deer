"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentProfileId } from "@/features/auth/dal";

export type GiftReadyResult = { ok: true; isGiftReady: boolean } | { ok: false; message: string };

/** "Hediyemi aldım, hazırım" onayı (geri alınabilir). Yalnızca eşleşme sonrası fazlarda. */
export async function setGiftReady(ready: boolean): Promise<GiftReadyResult> {
  const profileId = await getCurrentProfileId();
  if (!profileId) redirect("/kayit");

  const settings = await db.eventSettings.findUnique({ where: { id: 1 }, select: { phase: true } });
  if (settings?.phase !== "MATCHED" && settings?.phase !== "EVENT_DAY") {
    return { ok: false, message: "Bu onay eşleşmeler açıklandıktan sonra verilebilir." };
  }

  const updated = await db.participantProfile.update({
    where: { id: profileId },
    data: { isGiftReady: ready },
    select: { isGiftReady: true },
  });
  refresh();
  return { ok: true, isGiftReady: updated.isGiftReady };
}
