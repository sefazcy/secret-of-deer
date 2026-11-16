import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { RegisterFlow } from "@/features/auth/components/register-flow";
import { getCurrentIdentity, getCurrentProfileId } from "@/features/auth/dal";

export const metadata: Metadata = { title: "Katıl" };

/** Zaten giriş yapmış öğrenciyi doğrudan devam edeceği yere gönderir. */
async function RedirectIfSignedIn() {
  const identity = await getCurrentIdentity();
  if (!identity) return null;
  redirect((await getCurrentProfileId()) ? "/panel" : "/profil-olustur");
}

export default function RegisterPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8 sm:py-12">
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>

      <p className="text-sm font-semibold uppercase tracking-widest text-gold">Kayıt · Giriş</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Hacettepe e-postanla katıl</h1>
      <p className="mt-2 text-ink-muted">
        Okul adresine tek kullanımlık bir kod göndereceğiz. Şifre yok; daha önce kaydolduysan aynı yolla giriş yaparsın.
      </p>

      <Card className="mt-6">
        <RegisterFlow />
      </Card>

      <p className="mt-6 text-center text-xs text-ink-muted">
        🔒 E-posta adresin şifreli saklanır ve kimseye gösterilmez. Etkinlik sonunda kalıcı olarak silinir.
      </p>
    </div>
  );
}
