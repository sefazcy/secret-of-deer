import type { Metadata } from "next";
import { ComingSoon, PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Ekip Girişi", robots: { index: false } };

export default function StaffLoginPage() {
  return (
    <PageShell title="Ekip girişi" description="Yönetim ve saha ekibi için.">
      <ComingSoon items={["ADMIN_PASSWORD → yönetim paneli", "CHECKIN_PASSWORD → yalnızca check-in ekranı"]} />
    </PageShell>
  );
}
