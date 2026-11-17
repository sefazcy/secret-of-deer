import "server-only";
import { formatEnvIssues, parseEnv, type Env } from "./env-schema";

export type { Env } from "./env-schema";

/**
 * Sunucu ortam değişkenleri. Sunucu başlarken `src/instrumentation.ts` tarafından doğrulanır
 * (hatalıysa sunucu istek kabul etmeden durur); ayrıca ilk erişimde yeniden doğrulanıp önbelleğe alınır.
 */
let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const result = parseEnv(process.env);
  if (!result.ok) throw new Error(formatEnvIssues(result.issues));
  cached = result.env;
  return cached;
}
