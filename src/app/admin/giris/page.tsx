import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { getStaffRole } from "@/features/admin/dal";
import { StaffLoginForm } from "@/features/admin/components/staff-login-form";

export const metadata: Metadata = { title: "Ekip Girişi", robots: { index: false } };

async function RedirectIfStaff() {
  const role = await getStaffRole();
  if (role) redirect(role === "admin" ? "/admin" : "/admin/check-in");
  return null;
}

export default function StaffLoginPage() {
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10">
      <Suspense fallback={null}>
        <RedirectIfStaff />
      </Suspense>
      <p className="text-sm font-semibold uppercase tracking-widest text-gold">Organizasyon ekibi</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Ekip girişi</h1>
      <p className="mt-2 text-ink-muted">Yönetim paneli ve kapı check-in ekranı için.</p>
      <Card className="mt-6">
        <StaffLoginForm />
      </Card>
    </div>
  );
}
