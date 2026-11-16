"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setGiftReady } from "../actions";

export function GiftReady({ isGiftReady }: { isGiftReady: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [ready, setOptimisticReady] = useOptimistic(isGiftReady);

  function update(next: boolean) {
    startTransition(async () => {
      setOptimisticReady(next);
      const res = await setGiftReady(next);
      if (!res.ok) toast.error(res.message);
      else if (next) toast.success("Harika! Hediyen hazır olarak işaretlendi 🎁");
    });
  }

  if (ready) {
    return (
      <div className="rounded-2xl border-2 border-pine bg-pine/10 p-5 text-center" role="status">
        <p className="text-3xl" aria-hidden>
          🎁
        </p>
        <p className="mt-1 text-lg font-bold text-pine">Hediyen hazır!</p>
        <p className="mt-1 text-sm text-ink-muted">Etkinlik günü hediyeni ve QR biletini getirmeyi unutma.</p>
        <button
          type="button"
          onClick={() => update(false)}
          disabled={isPending}
          className="mt-2 min-h-11 text-sm text-ink-muted underline underline-offset-4"
        >
          Henüz almadım, geri al
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-gold bg-surface p-5">
      <p className="font-semibold">Hediyeni aldın mı?</p>
      <p className="mt-1 text-sm text-ink-muted">
        Onay vermen, kimsenin etkinlikte eli boş kalmaması için ekibin hazırlık yapmasına yardımcı olur.
      </p>
      <Button className="mt-4 w-full" onClick={() => update(true)} disabled={isPending}>
        Hediyemi aldım, hazırım 🎁
      </Button>
    </div>
  );
}
