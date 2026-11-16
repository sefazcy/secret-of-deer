"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BUDGET_TIERS, type BudgetTierKey } from "@/lib/constants";
import type { MatchingSummary } from "@/features/matching/service";
import { finalizeAndNotify, simulateMatchingAction, startEventDay } from "../actions";

type Phase = "REGISTRATION" | "MATCHED" | "EVENT_DAY" | "CLOSED";

function tierLabel(tier: string) {
  return BUDGET_TIERS[tier as BudgetTierKey]?.label ?? tier;
}

function SummaryView({ summary }: { summary: MatchingSummary }) {
  return (
    <div className="space-y-3" aria-live="polite">
      <div className="grid gap-3 sm:grid-cols-2">
        {summary.groups.map((g) => (
          <div key={g.budgetTier} className="rounded-xl bg-surface-muted p-4">
            <p className="font-semibold">{tierLabel(g.budgetTier)}</p>
            <dl className="mt-2 grid grid-cols-2 gap-1 text-sm">
              <dt className="text-ink-muted">Kişi</dt>
              <dd className="text-right font-semibold tabular-nums">{g.size}</dd>
              <dt className="text-ink-muted">Eşleşen</dt>
              <dd className="text-right font-semibold tabular-nums">{g.matched}</dd>
              <dt className="text-ink-muted">Ortak ilgi alanlı</dt>
              <dd className="text-right font-semibold tabular-nums">%{Math.round(g.withCommonInterestRatio * 100)}</dd>
              <dt className="text-ink-muted">Ort. ortak alan</dt>
              <dd className="text-right font-semibold tabular-nums">{g.avgCommonInterests.toFixed(1)}</dd>
            </dl>
          </div>
        ))}
      </div>
      {summary.warnings.map((w) => (
        <p key={w} className="rounded-xl border-2 border-gold/60 bg-gold/10 px-3 py-2 text-sm">
          ⚠️ {w.replace(/TIER_\d+_\d+/, (t) => tierLabel(t))}
        </p>
      ))}
      <p className="text-xs text-ink-muted">
        🔒 Gizlilik gereği kimin kime çıktığı gösterilmez; yalnızca grup istatistikleri.
      </p>
    </div>
  );
}

export function MatchingControls({ phase, hasBlockingIssue }: { phase: Phase; hasBlockingIssue: boolean }) {
  const [summary, setSummary] = useState<MatchingSummary | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (phase === "MATCHED") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">
          Eşleşmeler kesinleşti. Etkinlik günü kapı açılmadan önce bilet modunu açın; öğrenci panellerinde QR bilet
          görünür.
        </p>
        <Button
          variant="secondary"
          className="w-full"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await startEventDay();
              if (res.ok) toast.success(res.message);
              else toast.error(res.message);
            })
          }
        >
          🎟️ Bilet modunu aç (Etkinlik günü)
        </Button>
      </div>
    );
  }

  if (phase !== "REGISTRATION") {
    return <p className="text-sm text-ink-muted">Eşleştirme tamamlandı.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          variant="ghost"
          className="flex-1"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setSummary(await simulateMatchingAction());
              setConfirming(false);
            })
          }
        >
          🧪 Eşleştirmeyi simüle et
        </Button>
        <Button
          className="flex-1"
          disabled={isPending || hasBlockingIssue}
          onClick={() => setConfirming(true)}
          title={hasBlockingIssue ? "Önce 2'den az kişili grupları düzeltin" : undefined}
        >
          ✅ Kesinleştir & bildirim gönder
        </Button>
      </div>

      {confirming && (
        <div role="alertdialog" aria-labelledby="finalize-title" className="rounded-xl border-2 border-holly p-4">
          <p id="finalize-title" className="font-semibold">
            Eşleşmeler kesinleştirilsin mi?
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Kayıtlar kapanır, profil düzenleme kilitlenir ve tüm katılımcılara e-posta gider. Bu adım geri alınamaz.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={isPending}>
              Vazgeç
            </Button>
            <Button
              className="flex-1"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const res = await finalizeAndNotify();
                  if (res.summary) setSummary(res.summary);
                  setConfirming(false);
                  if (res.ok) toast.success(res.message);
                  else toast.error(res.message);
                })
              }
            >
              {isPending ? "Gönderiliyor…" : "Evet, kesinleştir"}
            </Button>
          </div>
        </div>
      )}

      {summary && <SummaryView summary={summary} />}
    </div>
  );
}
