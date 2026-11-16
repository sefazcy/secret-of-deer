import type { Metadata } from "next";
import { ComingSoon, PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Check-in", robots: { index: false } };

export default function CheckInPage() {
  return (
    <PageShell title="Kapı check-in">
      <ComingSoon
        items={[
          "Kamera ile QR okutma",
          "6 haneli kodu elle girme (lib/ticket.ts normalizasyonu hazır)",
          "“Giriş yaptı” işaretleme ve anlık geri bildirim",
        ]}
      />
    </PageShell>
  );
}
