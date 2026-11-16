import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-night text-snow shadow-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span aria-hidden className="text-xl">🦌</span>
          Beytepe Geyiği
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/panel" className="rounded-lg px-3 py-2 hover:bg-white/10">
            Panelim
          </Link>
          <Link
            href="/kayit"
            className="rounded-lg bg-holly px-3 py-2 font-semibold text-holly-ink hover:brightness-110"
          >
            Katıl
          </Link>
        </nav>
      </div>
    </header>
  );
}
