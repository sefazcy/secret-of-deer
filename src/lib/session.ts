import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getIronSession, type SessionOptions } from "iron-session";
import { db } from "./db";
import { env } from "./env";
import { isSessionCurrent, type SessionData } from "./session-epoch";

export { bindSessionEpoch, isSessionCurrent, type SessionData, type StaffRole } from "./session-epoch";

export const SESSION_COOKIE = "bg_session";

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
 * Şifreli çerez oturumu (ham). Yetki kararı için doğrudan `identityId`/`staffRole` okumayın;
 * `getValidSession()` ya da DAL fonksiyonlarını kullanın (dönem kontrolü oradadır).
 * Cache Components açık olduğu için çağıran Server Component'ler <Suspense> içinde olmalıdır.
 */
export async function getSession() {
  const store = await cookies();
  // iron-session çerezi açarken TTL için Date.now() okur. Çerezler bilinirken yapılan ön render
  // (runtime prefetch) sırasında bu "kararsız değer" sayılır; çözümü isteğe ertelemek.
  await connection();
  return getIronSession<SessionData>(store, sessionOptions());
}

/** Geçerli oturum dönemi. Ayar satırı yoksa null (bu durumda hiçbir oturum geçerli sayılmaz). */
export async function getSessionEpoch(): Promise<number | null> {
  const s = await db.eventSettings.findUnique({ where: { id: 1 }, select: { sessionEpoch: true } });
  return s?.sessionEpoch ?? null;
}

/**
 * Oturum + dönem kontrolü. Veri imhasından önce açılmış (eski dönem) bir çerez ise
 * `current: false` döner ve içindeki kimlik/rol yok sayılmalıdır.
 */
export async function getValidSession() {
  const [session, epoch] = await Promise.all([getSession(), getSessionEpoch()]);
  return { session, epoch, current: isSessionCurrent(session, epoch) };
}
