import type { ReactNode } from "react";

/** İskelet aşamasındaki sayfalar için ortak başlık + içerik kabı. */
export function PageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {description && <p className="mt-2 text-ink-muted">{description}</p>}
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  );
}

/** Henüz yapılmamış bir ekranın kapsamını listeler. */
export function ComingSoon({ items }: { items: string[] }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-muted p-5">
      <p className="text-sm font-semibold text-gold">🚧 Bu ekran yapım aşamasında</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
