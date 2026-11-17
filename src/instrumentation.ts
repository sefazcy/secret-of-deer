/**
 * Sunucu başlarken bir kez çalışır (istek kabul edilmeden önce). Ortam değişkenleri hatalıysa
 * — özellikle üretimde MAIL_MODE=console, http:// SITE_URL, eksik SMTP ya da zayıf/aynı anahtarlar —
 * sunucu hiç ayağa kalkmaz.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { parseEnv, formatEnvIssues } = await import("./lib/env-schema");
  const result = parseEnv(process.env);
  if (!result.ok) throw new Error(formatEnvIssues(result.issues));
}
