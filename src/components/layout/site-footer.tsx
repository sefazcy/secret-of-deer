import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-muted">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <p>Beytepe Geyiği · Hacettepe öğrencileri için, öğrenciler tarafından ❄️</p>
        <Link href="/gizlilik-kvkk" className="underline underline-offset-4 hover:text-ink">
          Gizlilik & KVKK Aydınlatma Metni
        </Link>
      </div>
    </footer>
  );
}
