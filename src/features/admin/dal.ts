import "server-only";
import { redirect } from "next/navigation";
import { getSession, type StaffRole } from "@/lib/session";

/** Oturumdaki ekip rolü (yoksa null). Çağıran bileşen <Suspense> içinde olmalı. */
export async function getStaffRole(): Promise<StaffRole | null> {
  const session = await getSession();
  return session.staffRole ?? null;
}

/**
 * Yetki kontrolü. "admin" her şeye erişir; "checkin" yalnızca kapı ekranına.
 * Yetkisizse ekip giriş sayfasına yönlendirir.
 */
export async function requireStaff(needed: StaffRole): Promise<StaffRole> {
  const role = await getStaffRole();
  if (!role) redirect("/admin/giris");
  if (needed === "admin" && role !== "admin") redirect("/admin/check-in");
  return role;
}
