import type { Metadata } from "next";
import { ComingSoon, PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Yönetim Paneli", robots: { index: false } };

export default function AdminPage() {
  return (
    <PageShell title="Yönetim paneli">
      <ComingSoon
        items={[
          "KPI kartları: doğrulanmış öğrenci, bütçe dağılımı, “hediyemi aldım” oranı, check-in oranı",
          "Eşleştirme motoru: tek/çift kontrolü, simülasyon, kesinleştir & bildirim (features/matching hazır)",
          "Kimin kime çıktığı listelenmez — sadece başarı oranı",
          "“Etkinliği sonlandır ve verileri imha et” (çift onaylı)",
        ]}
      />
    </PageShell>
  );
}
