import { INTEREST_LIMITS } from "@/lib/constants";

/**
 * Joker için ilgi alanları: gruptaki en yaygın etiketler. Böylece joker kime
 * atanırsa atansın ortak ilgi alanı olasılığı en yüksek olur.
 * Eşitlikte alfabetik sıra (deterministik).
 */
export function pickJokerInterests(groupInterests: readonly (readonly string[])[], count = 5): string[] {
  const freq = new Map<string, number>();
  for (const list of groupInterests) for (const slug of new Set(list)) freq.set(slug, (freq.get(slug) ?? 0) + 1);
  const n = Math.min(Math.max(count, INTEREST_LIMITS.min), INTEREST_LIMITS.max);
  return [...freq.entries()]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, n)
    .map(([slug]) => slug);
}
