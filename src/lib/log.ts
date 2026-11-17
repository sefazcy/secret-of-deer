/**
 * Log'a güvenle yazılabilecek hata özeti. Hata MESAJI bilerek atılır: SMTP/sürücü hataları
 * alıcı e-posta adresini, Prisma hataları alan değerlerini içerebilir. Yalnızca tür ve kod kalır.
 */
export function safeErrorSummary(err: unknown): string {
  if (err && typeof err === "object") {
    const name = (err as { name?: unknown }).name;
    const code = (err as { code?: unknown }).code;
    return [typeof name === "string" ? name : "Error", typeof code === "string" || typeof code === "number" ? `code=${code}` : ""]
      .filter(Boolean)
      .join(" ");
  }
  return "UnknownError";
}
