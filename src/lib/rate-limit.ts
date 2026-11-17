/**
 * Sabit pencereli hız sınırlayıcı.
 *
 * Sayaçların nerede tutulduğu `RateLimitStore` arayüzünün arkasındadır. Varsayılan depo süreç
 * içi bellektir (tek sunucu süreci için yeterli). Çok örnekli dağıtımda (cluster/serverless)
 * uygulama başlarken `setRateLimitStore(new RedisRateLimitStore(...))` çağrılarak tüm
 * sınırlayıcılar ortak depoya geçirilir — çağıran kodda değişiklik gerekmez. Örnek: README.
 *
 * Anahtarlara ham e-posta/IP dışında kişisel veri yazılmamalı; e-posta için HMAC özeti kullanın.
 */

export type RateLimitResult = {
  allowed: boolean;
  /** Pencerede kalan hak (engellendiyse 0). */
  remaining: number;
  retryAfterSeconds: number;
};

export interface RateLimitStore {
  /**
   * Anahtarın sayacını atomik olarak 1 artırır. Pencere yoksa ya da dolmuşsa `windowMs`
   * uzunluğunda yeni pencere başlatır. Artıştan sonraki sayaç ve pencere bitişini (epoch ms) döndürür.
   * Redis karşılığı: `INCR key` + (sonuç 1 ise) `PEXPIRE key windowMs` + `PTTL key`.
   */
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  /** Anahtarın sayacını siler (ör. başarılı girişten sonra). */
  reset(key: string): Promise<void>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async increment(key: string, windowMs: number) {
    const t = this.now();
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      this.hits.set(key, entry);
    }
    entry.count++;
    if (this.hits.size > 10_000) this.sweep(t);
    return { count: entry.count, resetAt: entry.resetAt };
  }

  async reset(key: string) {
    this.hits.delete(key);
  }

  private sweep(t: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k);
  }
}

// Next.js geliştirme modunda modüller yeniden yüklendiğinde sayaçlar sıfırlanmasın.
const g = globalThis as unknown as { __rateLimitStore?: RateLimitStore };

/** Tüm sınırlayıcıların varsayılan olarak kullandığı depo. */
export function getRateLimitStore(): RateLimitStore {
  return (g.__rateLimitStore ??= new MemoryRateLimitStore());
}

/** Ortak depoya (Redis vb.) geçiş: uygulama başlarken bir kez çağrılır. */
export function setRateLimitStore(store: RateLimitStore): void {
  g.__rateLimitStore = store;
}

export type RateLimiterOptions = {
  /** Anahtar ön eki; farklı sınırlayıcıların sayaçları karışmasın. */
  name: string;
  limit: number;
  windowMs: number;
  /** Verilmezse ortak depo (`getRateLimitStore()`) çağrı anında okunur. */
  store?: RateLimitStore;
  now?: () => number;
};

export class RateLimiter {
  readonly name: string;
  readonly limit: number;
  readonly windowMs: number;
  private readonly store?: RateLimitStore;
  private readonly now: () => number;

  constructor(opts: RateLimiterOptions) {
    this.name = opts.name;
    this.limit = opts.limit;
    this.windowMs = opts.windowMs;
    this.store = opts.store;
    this.now = opts.now ?? Date.now;
  }

  private key(key: string) {
    return `rl:${this.name}:${key}`;
  }

  private get backend() {
    return this.store ?? getRateLimitStore();
  }

  /** Bu anahtar için bir deneme kaydeder. */
  async consume(key: string): Promise<RateLimitResult> {
    const { count, resetAt } = await this.backend.increment(this.key(key), this.windowMs);
    return {
      allowed: count <= this.limit,
      remaining: Math.max(0, this.limit - count),
      retryAfterSeconds: Math.max(0, Math.ceil((resetAt - this.now()) / 1000)),
    };
  }

  async reset(key: string): Promise<void> {
    await this.backend.reset(this.key(key));
  }
}

/** Birden çok sınırlayıcıyı sırayla dener; ilk engelleyeni döndürür (yoksa null). */
export async function consumeAll(
  checks: ReadonlyArray<readonly [RateLimiter, string]>,
): Promise<{ limiter: RateLimiter; result: RateLimitResult } | null> {
  for (const [limiter, key] of checks) {
    const result = await limiter.consume(key);
    if (!result.allowed) return { limiter, result };
  }
  return null;
}

/** Kullanıcıya gösterilecek "şu kadar sonra tekrar dene" metni. */
export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, seconds)} saniye`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} dakika`;
  return `${Math.ceil(seconds / 3600)} saat`;
}
