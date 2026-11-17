import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryRateLimitStore, RateLimiter, consumeAll, formatRetryAfter, type RateLimitStore } from "./rate-limit";

test("sınırlayıcı pencere dolunca engeller, pencere bitince sıfırlar", async () => {
  let now = 0;
  const store = new MemoryRateLimitStore(() => now);
  const rl = new RateLimiter({ name: "t", limit: 3, windowMs: 60_000, store, now: () => now });
  assert.ok((await rl.consume("ip")).allowed);
  assert.ok((await rl.consume("ip")).allowed);
  const third = await rl.consume("ip");
  assert.ok(third.allowed);
  assert.equal(third.remaining, 0);
  const blocked = await rl.consume("ip");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 60);
  assert.ok((await rl.consume("baska-ip")).allowed, "anahtarlar bağımsız");
  now = 60_000;
  assert.ok((await rl.consume("ip")).allowed, "pencere sıfırlandı");
});

test("aynı depoyu paylaşan farklı adlı sınırlayıcıların sayaçları karışmaz; reset çalışır", async () => {
  const store = new MemoryRateLimitStore();
  const a = new RateLimiter({ name: "a", limit: 1, windowMs: 60_000, store });
  const b = new RateLimiter({ name: "b", limit: 1, windowMs: 60_000, store });
  assert.ok((await a.consume("k")).allowed);
  assert.ok((await b.consume("k")).allowed);
  assert.equal((await a.consume("k")).allowed, false);
  await a.reset("k");
  assert.ok((await a.consume("k")).allowed);
});

test("özel depo (Redis benzeri) arayüz üzerinden takılabilir", async () => {
  const calls: string[] = [];
  const fake: RateLimitStore = {
    async increment(key) {
      calls.push(key);
      return { count: 99, resetAt: Date.now() + 5_000 };
    },
    async reset() {},
  };
  const rl = new RateLimiter({ name: "redis", limit: 10, windowMs: 1_000, store: fake });
  const r = await rl.consume("1.2.3.4");
  assert.equal(r.allowed, false);
  assert.deepEqual(calls, ["rl:redis:1.2.3.4"]);
});

test("consumeAll ilk engelleyen katmanı döndürür", async () => {
  const store = new MemoryRateLimitStore();
  const ip = new RateLimiter({ name: "ip", limit: 5, windowMs: 60_000, store });
  const email = new RateLimiter({ name: "email", limit: 1, windowMs: 60_000, store });
  assert.equal(await consumeAll([[ip, "x"], [email, "y"]]), null);
  const blocked = await consumeAll([[ip, "x"], [email, "y"]]);
  assert.equal(blocked?.limiter, email);
});

test("bekleme süresi metni", () => {
  assert.equal(formatRetryAfter(30), "30 saniye");
  assert.equal(formatRetryAfter(0), "1 saniye");
  assert.equal(formatRetryAfter(61), "2 dakika");
  assert.equal(formatRetryAfter(7200), "2 saat");
});
