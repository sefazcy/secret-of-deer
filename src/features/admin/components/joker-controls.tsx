"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { BudgetTierKey } from "@/lib/constants";
import { addJoker, removeJoker } from "../actions";

export function AddJokerButton({ tier, label }: { tier: BudgetTierKey; label: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await addJoker(tier);
          if (res.ok) toast.success(res.message);
          else toast.error(res.message);
        })
      }
      className="min-h-11 rounded-lg border-2 border-gold px-3 text-sm font-semibold hover:bg-gold/10 disabled:opacity-50"
      aria-label={`${label} grubuna joker ekle`}
    >
      {isPending ? "Ekleniyor…" : "🃏 Joker ekle"}
    </button>
  );
}

export function RemoveJokerButton({ id, alias }: { id: string; alias: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const res = await removeJoker(id);
          if (res.ok) toast.success(res.message);
          else toast.error(res.message);
        })
      }
      className="min-h-11 px-2 text-sm text-ink-muted underline underline-offset-4 disabled:opacity-50"
      aria-label={`${alias} jokerini kaldır`}
    >
      Kaldır
    </button>
  );
}
