"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentProfileId } from "@/features/auth/dal";
import { MISSING_SETTINGS_MESSAGE, PhaseError, lockPhase } from "@/features/event/phase";

export type GiftReadyResult = { ok: true; isGiftReady: boolean } | { ok: false; message: string };

/** "Hediyemi aldım, hazırım" onayı (geri alınabilir). Yalnızca eşleşme sonrası fazlarda. */
export async function setGiftReady(ready: boolean): Promise<GiftReadyResult> {
  const profileId = await getCurrentProfileId();
  if (!profileId) redirect("/kayit");

  let updated;
  try {
    // Faz kontrolü ve yazma aynı transaction'da (imha/faz geçişiyle yarışamaz).
    updated = await db.$transaction(async (tx) => {
      await lockPhase(tx, ["MATCHED", "EVENT_DAY"]);
      return tx.participantProfile.update({
        where: { id: profileId },
        data: { isGiftReady: ready === true },
        select: { isGiftReady: true },
      });
    });
  } catch (err) {
    if (!(err instanceof PhaseError)) throw err;
    return {
      ok: false,
      message:
        err.reason === "missing_settings"
          ? MISSING_SETTINGS_MESSAGE
          : "Bu onay eşleşmeler açıklandıktan sonra verilebilir.",
    };
  }
  refresh();
  return { ok: true, isGiftReady: updated.isGiftReady };
}
