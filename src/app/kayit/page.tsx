import type { Metadata } from "next";
import { ComingSoon, PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Kayıt Ol" };

export default function RegisterPage() {
  return (
    <PageShell title="Hacettepe e-postanla katıl" description="Okul e-postana 6 haneli bir doğrulama kodu göndereceğiz.">
      <ComingSoon
        items={[
          "@hacettepe.edu.tr / @ogr.hacettepe.edu.tr uzantı doğrulaması (features/auth/schemas.ts hazır)",
          "6 haneli OTP giriş kutuları + 60 sn tekrar gönder sayacı",
          "KVKK ve “hediye almadan gelmeyeceğim” taahhüt onayları",
        ]}
      />
    </PageShell>
  );
}
