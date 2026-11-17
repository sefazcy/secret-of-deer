import "server-only";
import { headers } from "next/headers";

/**
 * İstemci IP'si (hız sınırı anahtarı için). `x-forwarded-for` başlığı istemci tarafından
 * uydurulabilir; üretimde uygulama bu başlığı ezen güvenilir bir ters vekil (nginx, Vercel vb.)
 * arkasında çalışmalıdır. Ayrıca hiçbir yerde log'a yazılmaz.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "local";
}
