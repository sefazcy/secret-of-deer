import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { env } from "./env";

export const SESSION_COOKIE = "bg_session";

export type StaffRole = "admin" | "checkin";

export type SessionData = {
  /** Doğrulanmış öğrencinin AuthIdentity.id değeri. */
  identityId?: string;
  /** Yönetim / saha ekibi oturumu. */
  staffRole?: StaffRole;
};

function sessionOptions(): SessionOptions {
  return {
    cookieName: SESSION_COOKIE,
    password: env().SESSION_SECRET,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 gün
    },
  };
}

/**
 * Şifreli çerez oturumu. Cache Components açık olduğu için bu fonksiyonu çağıran
 * Server Component'ler bir <Suspense> sınırı içinde olmalıdır.
 */
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions());
}
