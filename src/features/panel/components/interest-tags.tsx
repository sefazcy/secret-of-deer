import { INTERESTS } from "@/lib/constants";

/** İlgi alanı etiketleri; `highlight` içindekiler (ortak olanlar) altınla vurgulanır ve başa alınır. */
export function InterestTags({ slugs, highlight = [] }: { slugs: readonly string[]; highlight?: readonly string[] }) {
  const items = INTERESTS.filter((i) => slugs.includes(i.slug)).sort(
    (a, b) => Number(highlight.includes(b.slug)) - Number(highlight.includes(a.slug)),
  );
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((i) => {
        const common = highlight.includes(i.slug);
        return (
          <li
            key={i.slug}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              common ? "bg-gold text-night ring-2 ring-gold" : "bg-surface-muted text-ink"
            }`}
          >
            <span aria-hidden>{i.emoji}</span> {i.label}
            {common && <span className="sr-only"> (ortak ilgi alanınız)</span>}
          </li>
        );
      })}
    </ul>
  );
}
