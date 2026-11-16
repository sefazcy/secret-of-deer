"use client";

import { useSyncExternalStore } from "react";

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
const getNowSeconds = () => Math.floor(Date.now() / 1000);
const getServerNow = () => null; // Sunucuda saat yok → hydration uyuşmazlığı olmaz

const UNITS = [
  { label: "gün", seconds: 86400 },
  { label: "saat", seconds: 3600 },
  { label: "dk", seconds: 60 },
  { label: "sn", seconds: 1 },
] as const;

function splitDuration(totalSeconds: number): number[] {
  let rest = totalSeconds;
  return UNITS.map(({ seconds }) => {
    const value = Math.floor(rest / seconds);
    rest -= value * seconds;
    return value;
  });
}

export function Countdown({ target }: { target: string }) {
  const now = useSyncExternalStore(subscribe, getNowSeconds, getServerNow);
  const targetSeconds = Math.floor(new Date(target).getTime() / 1000);

  if (now !== null && now >= targetSeconds) {
    return <p className="text-lg font-semibold text-gold">Kayıtlar kapandı ❄️</p>;
  }

  const values = now === null ? null : splitDuration(targetSeconds - now);
  return (
    <div role="timer" aria-label="Kayıtların kapanmasına kalan süre" className="grid grid-cols-4 gap-2">
      {UNITS.map(({ label }, i) => {
        const value = values?.[i] ?? null;
        return (
          <div key={label} className="rounded-xl bg-white/10 px-2 py-3 text-center backdrop-blur">
            <div className="text-2xl font-bold tabular-nums sm:text-3xl">
              {value === null ? "––" : value.toString().padStart(2, "0")}
            </div>
            <div className="text-xs uppercase tracking-wide text-white/70">{label}</div>
          </div>
        );
      })}
    </div>
  );
}
