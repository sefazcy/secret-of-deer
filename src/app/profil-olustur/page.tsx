import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { getCurrentIdentity, getCurrentProfileId } from "@/features/auth/dal";
import { ProfileWizard } from "@/features/profile/components/profile-wizard";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Profilini Oluştur" };

/** Giriş yapmamışı /kayit'a, profili olanı /panel'e gönderir; kayıtlar kapalıysa bilgi verir. */
async function WizardGate() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/kayit");
  if (await getCurrentProfileId()) redirect("/panel");

  const settings = await db.eventSettings.findUnique({ where: { id: 1 }, select: { phase: true } });
  if (settings && settings.phase !== "REGISTRATION") {
    return <p className="text-ink-muted">Kayıtlar kapandığı için artık yeni profil oluşturulamıyor. ❄️</p>;
  }
  return <ProfileWizard />;
}

function WizardSkeleton() {
  return (
    <div aria-busy className="animate-pulse space-y-4">
      <div className="h-1.5 rounded-full bg-border" />
      <div className="h-6 w-2/3 rounded bg-border" />
      <div className="h-12 rounded-xl bg-border" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="mx-auto size-14 rounded-full bg-border" />
        ))}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-gold">Profil</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Seni tanıyalım 🦌</h1>
      <p className="mt-2 text-ink-muted">3 kısa adım. Bu bilgiler sadece eşleştiğin kişiye, rumuzunla gösterilir.</p>
      <Card className="mt-6">
        <Suspense fallback={<WizardSkeleton />}>
          <WizardGate />
        </Suspense>
      </Card>
    </div>
  );
}
