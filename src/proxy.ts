import { NextResponse, type NextRequest } from "next/server";

// Proxy yalnızca "iyimser" kontrol yapar: çerez hiç yoksa giriş sayfasına yönlendirir.
// Asıl yetki kontrolü sunucu tarafında (oturum çözülerek) her sayfada/aksiyonda yapılır.
const SESSION_COOKIE = "bg_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/giris") && !hasSession) {
    return NextResponse.redirect(new URL("/admin/giris", request.url));
  }

  if ((pathname.startsWith("/panel") || pathname.startsWith("/profil-olustur")) && !hasSession) {
    return NextResponse.redirect(new URL("/kayit", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/panel/:path*", "/profil-olustur/:path*"],
};
