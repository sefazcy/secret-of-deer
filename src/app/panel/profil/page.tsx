import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { getEditableProfile } from "@/features/panel/queries";
import { ProfileWizard } from "@/features/profile/components/profile-wizard";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Profilini Düzenle" };

async function EditGate() {
  const settings = await db.eventSettings.findUnique({ where: { id: 1 }, select: { phase: true } });
  // Eşleşmeler ilgi alanı/bütçeye göre yapıldığından sonrasında düzenleme kapalı.
  if (settings && settings.phase !== "REGISTRATION") redirect("/panel");
  const profile = await getEditableProfile();
  if (!profile) redirect("/panel");
  return <ProfileWizard mode="edit" initial={profile} />;
}

export default function EditProfilePage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-bold tracking-tight">Profilini düzenle</h1>
      <p className="mt-2 text-ink-muted">Kayıtlar kapanana kadar istediğin zaman değiştirebilirsin.</p>
      <Card className="mt-6">
        <Suspense fallback={<div aria-busy className="h-64 animate-pulse rounded-xl bg-border" />}>
          <EditGate />
        </Suspense>
      </Card>
    </div>
  );
}
