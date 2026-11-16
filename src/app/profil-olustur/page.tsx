import type { Metadata } from "next";
import { ComingSoon, PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Profilini Oluştur" };

export default function OnboardingPage() {
  return (
    <PageShell title="Profilini oluştur" description="3 kısa adım: rumuz, ilgi alanları ve hediye ipuçları.">
      <ComingSoon
        items={[
          "Adım 1: Rumuz + “Rastgele rumuz üret” (features/profile/alias.ts hazır) + avatar seçici",
          "Adım 2: 3–7 ilgi alanı etiketi + bütçe bandı",
          "Adım 3: Hediye ipuçları (250) ve istenmeyenler/alerjiler (150)",
        ]}
      />
    </PageShell>
  );
}
