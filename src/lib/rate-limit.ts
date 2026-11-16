/**
 * Basit, süreç içi sabit pencereli deneme sınırlayıcı.
 * Tek sunucu süreci için yeterli; birden çok örnekte (serverless/cluster) sayaçlar paylaşılmaz.
 * Üretimde çok örnekli dağıtımda Redis gibi ortak bir depoya taşınmalı.
 */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Bu anahtar için bir deneme kaydeder. İzin varsa true. */
  consume(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const t = this.now();
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + this.windowMs };
      this.hits.set(key, entry);
    }
    entry.count++;
    if (this.hits.size > 10_000) this.sweep(t);
    return {
      allowed: entry.count <= this.limit,
      retryAfterSeconds: Math.max(0, Math.ceil((entry.resetAt - t) / 1000)),
    };
  }

  reset(key: string) {
    this.hits.delete(key);
  }

  private sweep(t: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k);
  }
}
