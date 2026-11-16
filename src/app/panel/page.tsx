import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { getParticipantCount } from "@/features/event/queries";

export const metadata: Metadata = { title: "Panelim" };

async function ParticipantCount() {
  const count = await getParticipantCount();
  return <>{count} kişi</>;
}

export default function PanelPage() {
  return (
    <PageShell title="Panelim">
      <Card className="flex items-center justify-between">
        <span className="text-ink-muted">Şu ana kadar katılan</span>
        <span className="text-2xl font-bold tabular-nums">
          {/* Canlı sayaç: kısa önbellek ömrü nedeniyle istek anında stream edilir */}
          <Suspense fallback={<span className="text-ink-muted">…</span>}>
            <ParticipantCount />
          </Suspense>
        </span>
      </Card>
      <ComingSoon
        items={[
          "Faz 1: Kayıt onay rozeti, canlı katılımcı sayacı, profil düzenleme",
          "Faz 2: Eşleştiğin kişinin rumuzu, ortak ilgi alanları, ipuçları + “Hediyemi aldım” butonu",
          "Faz 3: Sabit büyük QR bilet + 6 haneli yedek kod",
        ]}
      />
    </PageShell>
  );
}
