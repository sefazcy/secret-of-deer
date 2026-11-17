import Link from "next/link";
import { Suspense } from "react";
import { getStaffRole } from "@/features/admin/dal";
import { getCurrentIdentity } from "@/features/auth/dal";

const primary = "rounded-lg bg-holly px-3 py-2 font-semibold text-holly-ink hover:brightness-110";
const plain = "rounded-lg px-3 py-2 hover:bg-white/10";

/** Oturuma göre menü: ziyaretçi → Katıl, öğrenci → Panelim, ekip → Yönetim / Check-in. */
async function HeaderNav() {
  const [staff, identity] = await Promise.all([getStaffRole(), getCurrentIdentity()]);
  return (
    <>
      {staff && (
        <Link href={staff === "admin" ? "/admin" : "/admin/check-in"} className={plain}>
          {staff === "admin" ? "Yönetim" : "Check-in"}
        </Link>
      )}
      {identity ? (
        <Link href="/panel" className={primary}>
          Panelim
        </Link>
      ) : (
        !staff && (
          <Link href="/kayit" className={primary}>
            Katıl
          </Link>
        )
      )}
    </>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-night text-snow shadow-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span aria-hidden className="text-xl">🦌</span>
          Beytepe Geyiği
        </Link>
        <nav className="flex items-center gap-1 text-sm" aria-label="Ana menü">
          {/* Oturum okunurken yer tutucu: yanlış butonun bir an görünmesini (flash) önler. */}
          <Suspense fallback={<span className="h-9 w-20 rounded-lg bg-white/10" aria-hidden />}>
            <HeaderNav />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
