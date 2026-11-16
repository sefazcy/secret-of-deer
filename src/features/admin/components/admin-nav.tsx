import Link from "next/link";
import type { StaffRole } from "@/lib/session";
import { staffLogout } from "../actions";

export function AdminNav({ role, current }: { role: StaffRole; current: "admin" | "checkin" }) {
  const tab = (active: boolean) =>
    `min-h-11 content-center rounded-lg px-3 text-sm font-semibold ${active ? "bg-night text-snow" : "text-ink-muted hover:bg-surface-muted"}`;
  return (
    <nav aria-label="Yönetim menüsü" className="flex items-center justify-between gap-2 border-b border-border pb-3">
      <div className="flex gap-1">
        {role === "admin" && (
          <Link href="/admin" className={tab(current === "admin")} aria-current={current === "admin" ? "page" : undefined}>
            Yönetim
          </Link>
        )}
        <Link
          href="/admin/check-in"
          className={tab(current === "checkin")}
          aria-current={current === "checkin" ? "page" : undefined}
        >
          Check-in
        </Link>
      </div>
      <form action={staffLogout}>
        <button type="submit" className="min-h-11 px-2 text-sm text-ink-muted underline underline-offset-4">
          Ekip çıkışı
        </button>
      </form>
    </nav>
  );
}
