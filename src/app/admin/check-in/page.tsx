import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { requireStaff } from "@/features/admin/dal";
import { AdminNav } from "@/features/admin/components/admin-nav";
import { getCheckInStats } from "@/features/checkin/actions";
import { CheckInStation } from "@/features/checkin/components/check-in-station";

export const metadata: Metadata = { title: "Check-in", robots: { index: false } };

async function CheckInGate() {
  const role = await requireStaff("checkin");
  const [stats, settings] = await Promise.all([
    getCheckInStats(),
    db.eventSettings.findUnique({ where: { id: 1 }, select: { phase: true } }),
  ]);
  return (
    <>
      <AdminNav role={role} current="checkin" />
      <h1 className="mt-5 text-2xl font-bold tracking-tight">Kapı check-in</h1>
      <div className="mt-4">
        <CheckInStation initialStats={stats} isOpen={settings?.phase === "EVENT_DAY"} />
      </div>
    </>
  );
}

export default function CheckInPage() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <Suspense fallback={<div aria-busy className="h-96 animate-pulse rounded-2xl bg-border" />}>
        <CheckInGate />
      </Suspense>
    </div>
  );
}
