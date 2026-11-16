"use client";

import { useCallback, useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/features/profile/components/avatar";
import { formatTime } from "@/lib/format";
import { checkIn, getCheckInStats, undoCheckIn, type CheckInResult } from "../actions";
import { useQrScanner } from "../use-qr-scanner";

// İstemci tarafı alfabe kontrolü (lib/ticket.ts node:crypto kullandığı için buraya alınmadı).
const CODE_CHARS = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g;

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Desteklenmiyorsa sessizce geç.
  }
}

export function CheckInStation({
  initialStats,
  isOpen,
}: {
  initialStats: { checkedIn: number; total: number };
  isOpen: boolean;
}) {
  const uid = useId();
  const [stats, setStats] = useState(initialStats);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();

  const refreshStats = useCallback(async () => {
    try {
      setStats(await getCheckInStats());
    } catch {
      // Ağ hatasında eski sayılar kalsın.
    }
  }, []);

  // Birden çok gönüllü aynı anda çalıştığı için sayaç periyodik olarak tazelenir.
  useEffect(() => {
    const id = setInterval(refreshStats, 15_000);
    return () => clearInterval(id);
  }, [refreshStats]);

  const submit = useCallback(
    async (input: string) => {
      const res = await checkIn(input);
      setResult(res);
      if (res.status === "ok") vibrate(80);
      else vibrate([80, 60, 80]);
      if (res.status === "ok" || res.status === "already") await refreshStats();
    },
    [refreshStats],
  );

  // Parçalara ayrılıyor: nesne içinde ref olduğu için React Compiler tüm erişimleri ref okuma sanıyordu.
  const { videoRef, start, stop, active, starting, error: cameraError, engine } = useQrScanner(submit);

  function onManualSubmit() {
    if (code.length !== 6) {
      toast.error("Kod 6 karakter olmalı.");
      return;
    }
    startTransition(async () => {
      await submit(code);
      setCode("");
    });
  }

  function onUndo(ticket: string) {
    startTransition(async () => {
      const res = await undoCheckIn(ticket);
      if (res.ok) {
        toast.success("Giriş geri alındı.");
        setResult(null);
        await refreshStats();
      } else toast.error("Geri alınamadı.");
    });
  }

  const pct = stats.total ? Math.round((stats.checkedIn / stats.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <section aria-label="Giriş istatistiği" className="rounded-2xl bg-night p-4 text-snow">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-white/75">Giriş yapan</p>
          <p className="text-2xl font-bold tabular-nums">
            {stats.checkedIn} <span className="text-base font-medium text-white/75">/ {stats.total}</span>
          </p>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-white/15"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Giriş oranı"
        >
          <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
        </div>
      </section>

      {!isOpen && (
        <p className="rounded-xl border-2 border-gold/60 bg-gold/10 px-4 py-3 text-sm">
          ⏳ Bilet modu henüz açılmadı. Yönetim panelinden “Bilet modunu aç” denince check-in başlar.
        </p>
      )}

      <ResultCard result={result} onUndo={onUndo} busy={isPending} />

      <section aria-label="QR tarayıcı" className="space-y-3">
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-night">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`h-full w-full object-cover ${active ? "" : "invisible"}`}
          />
          {active ? (
            <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-gold/80" />
          ) : (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-white/75">
              <p>{cameraError ?? "QR okutmak için kamerayı aç"}</p>
            </div>
          )}
        </div>
        <Button
          variant={active ? "ghost" : "secondary"}
          className="w-full"
          disabled={starting}
          onClick={() => (active ? stop() : start())}
        >
          {starting ? "Kamera açılıyor…" : active ? "Kamerayı kapat" : "📷 Kamerayı aç"}
        </Button>
        {active && engine && (
          <p className="text-center text-xs text-ink-muted">
            Tarayıcı: {engine === "native" ? "yerleşik" : "jsQR"} · Bileti çerçeveye hizala
          </p>
        )}
      </section>

      <form
        noValidate
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          onManualSubmit();
        }}
      >
        <label htmlFor={`${uid}code`} className="block font-semibold">
          Ya da 6 haneli kodu gir
        </label>
        <div className="flex gap-2">
          <input
            id={`${uid}code`}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(CODE_CHARS, "").slice(0, 6))}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABC123"
            disabled={isPending}
            className="h-14 min-w-0 flex-1 rounded-xl border-2 border-border bg-surface px-4 text-center font-mono text-2xl font-bold tracking-[0.3em] outline-none focus:border-gold"
          />
          <Button type="submit" disabled={isPending || code.length !== 6} className="h-14">
            Doğrula
          </Button>
        </div>
        <p className="text-xs text-ink-muted">0, 1, I, L ve O harfleri kodlarda kullanılmaz.</p>
      </form>
    </div>
  );
}

function ResultCard({
  result,
  onUndo,
  busy,
}: {
  result: CheckInResult | null;
  onUndo: (code: string) => void;
  busy: boolean;
}) {
  return (
    <div aria-live="assertive" aria-atomic>
      {result && (
        <div
          role="status"
          className={`rounded-2xl border-4 p-4 ${
            result.status === "ok"
              ? "border-pine bg-pine/10"
              : result.status === "already"
                ? "border-gold bg-gold/10"
                : "border-holly bg-holly/10"
          }`}
        >
          {result.status === "ok" || result.status === "already" ? (
            <>
              <p className={`text-lg font-extrabold ${result.status === "ok" ? "text-pine" : "text-ink"}`}>
                {result.status === "ok" ? "✅ GİRİŞ ONAYLANDI" : "⚠️ BU BİLETLE ZATEN GİRİŞ YAPILMIŞ"}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Avatar avatarId={result.person.avatarId} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-xl font-bold">{result.person.alias}</p>
                  <p className="font-mono text-sm text-ink-muted">
                    {result.person.code}
                    {result.person.isJoker && " · 🃏 Joker"}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold">
                {result.person.isGiftReady ? "🎁 Hediyesini hazırladığını onaylamış" : "❗ Hediye onayı yok, hediyesini sor"}
              </p>
              {result.status === "already" && result.person.checkedInAt && (
                <p className="mt-1 text-sm text-ink-muted">İlk giriş: {formatTime(result.person.checkedInAt)}</p>
              )}
              {result.status === "ok" && (
                <button
                  type="button"
                  onClick={() => onUndo(result.person.code)}
                  disabled={busy}
                  className="mt-2 min-h-11 text-sm text-ink-muted underline underline-offset-4"
                >
                  Yanlışlıkla mı? Girişi geri al
                </button>
              )}
            </>
          ) : (
            <p className="text-lg font-extrabold text-holly">
              {result.status === "not_found"
                ? `❌ BİLET BULUNAMADI (${result.code})`
                : `❌ ${result.message}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
