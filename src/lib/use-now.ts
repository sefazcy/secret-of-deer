"use client";

import { useSyncExternalStore } from "react";

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
const getNow = () => Math.floor(Date.now() / 1000) * 1000;
const getServerNow = () => null;

/**
 * Saniyede bir güncellenen "şimdi" (ms). Sunucu render'ında null döner;
 * böylece saat kaynaklı hydration uyuşmazlığı olmaz.
 */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, getNow, getServerNow);
}
