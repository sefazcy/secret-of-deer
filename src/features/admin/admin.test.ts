import { test } from "node:test";
import assert from "node:assert/strict";
import { RateLimiter } from "@/lib/rate-limit";
import { pickJokerInterests } from "./joker";
import { PURGE_CONFIRMATION, isPurgeConfirmed } from "./purge-confirmation";

test("deneme sınırlayıcı pencere dolunca engeller, pencere bitince sıfırlar", () => {
  let now = 0;
  const rl = new RateLimiter(3, 60_000, () => now);
  assert.ok(rl.consume("ip").allowed);
  assert.ok(rl.consume("ip").allowed);
  assert.ok(rl.consume("ip").allowed);
  const blocked = rl.consume("ip");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 60);
  assert.ok(rl.consume("baska-ip").allowed, "anahtarlar bağımsız");
  now = 60_000;
  assert.ok(rl.consume("ip").allowed, "pencere sıfırlandı");
});

test("joker en yaygın ilgi alanlarını alır ve 3–7 sınırında kalır", () => {
  const group = [
    ["kitap", "kahve", "oyun"],
    ["kitap", "kahve", "anime"],
    ["kitap", "spor", "muzik"],
  ];
  assert.deepEqual(pickJokerInterests(group, 3), ["kitap", "kahve", "anime"]);
  assert.equal(pickJokerInterests(group, 1).length, 3, "en az 3");
  assert.equal(pickJokerInterests(group, 99).length, 6, "eldeki farklı etiket kadar");
  assert.equal(new Set(pickJokerInterests([["a", "a", "b"]], 3)).size, pickJokerInterests([["a", "a", "b"]], 3).length);
});

test("imha onayı yalnızca tam ifadeyle kabul edilir (Türkçe büyük harf duyarlı)", () => {
  assert.ok(isPurgeConfirmed(PURGE_CONFIRMATION));
  assert.ok(isPurgeConfirmed(`  ${PURGE_CONFIRMATION} `));
  assert.ok(isPurgeConfirmed("verileri imha et"), "Türkçe küçük harf de olur");
  assert.ok(!isPurgeConfirmed("VERILERI IMHA ET"), "noktasız I farklı harf");
  assert.ok(!isPurgeConfirmed("evet"));
  assert.ok(!isPurgeConfirmed(""));
});
