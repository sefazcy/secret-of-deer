import { test } from "node:test";
import assert from "node:assert/strict";
import { ALIAS_SUGGESTION_ATTEMPTS, aliasKey, findFreeAlias, generateAlias, generateSuffixedAlias, normalizeAlias } from "./alias";
import { aliasStepSchema, interestsStepSchema, profileSchema, giftNotesStepSchema } from "./schemas";

test("rumuz anahtarı Türkçe büyük/küçük harf ve boşluklardan bağımsız", () => {
  assert.equal(normalizeAlias("  Beytepe   Tilkisi "), "Beytepe Tilkisi");
  assert.equal(aliasKey("BEYTEPE  TİLKİSİ"), aliasKey("beytepe tilkisi"));
  // Türkçe: "I" → "ı" (noktasız), "İ" → "i"
  assert.equal(aliasKey("IŞIK"), "ışık");
  assert.equal(aliasKey("İZMİR"), "izmir");
  assert.notEqual(aliasKey("Işık"), aliasKey("işik"));
});

test("üretilen rumuzlar şemadan geçer", () => {
  for (let i = 0; i < 200; i++) {
    const alias = generateAlias();
    assert.ok(aliasStepSchema.safeParse({ alias, avatarId: "geyik" }).success, alias);
  }
});

test("rumuz kuralları", () => {
  const ok = (alias: string) => aliasStepSchema.safeParse({ alias, avatarId: "tilki" }).success;
  assert.ok(ok("Çılgın Öğrenci 42"));
  assert.ok(ok("Kahve'ci Kız"));
  assert.ok(!ok("ab"), "çok kısa");
  assert.ok(!ok("a".repeat(25)), "çok uzun");
  assert.ok(!ok("<script>"), "özel karakter");
  assert.ok(!ok("🦌🦌🦌"), "emoji");
  assert.equal(aliasStepSchema.safeParse({ alias: "x y z", avatarId: "uzayli" }).success, false, "geçersiz avatar");
});

test("ilgi alanı sayısı 3–7 arası, tekrarsız ve listeden olmalı", () => {
  const parse = (interests: string[]) => interestsStepSchema.safeParse({ interests, budgetTier: "TIER_300_450" });
  assert.ok(parse(["kitap", "kahve", "oyun"]).success);
  assert.ok(parse(["kitap", "kahve", "oyun", "muzik", "yazilim", "sinema", "anime"]).success);
  assert.ok(!parse(["kitap", "kahve"]).success, "2 az");
  assert.ok(!parse(["kitap", "kahve", "oyun", "muzik", "yazilim", "sinema", "anime", "spor"]).success, "8 fazla");
  assert.ok(!parse(["kitap", "kitap", "kahve"]).success, "tekrar");
  assert.ok(!parse(["kitap", "kahve", "golf"]).success, "listede yok");
  assert.ok(!interestsStepSchema.safeParse({ interests: ["kitap", "kahve", "oyun"], budgetTier: "TIER_0" }).success);
});

test("hediye notlarında karakter sınırları ve boş değer", () => {
  assert.ok(giftNotesStepSchema.safeParse({ giftHints: "a".repeat(250), giftExclusions: "b".repeat(150) }).success);
  assert.ok(!giftNotesStepSchema.safeParse({ giftHints: "a".repeat(251), giftExclusions: "" }).success);
  assert.ok(!giftNotesStepSchema.safeParse({ giftHints: "", giftExclusions: "b".repeat(151) }).success);
  assert.deepEqual(giftNotesStepSchema.parse({}), { giftHints: "", giftExclusions: "" });
});

test("tam profil şeması rumuzu normalleştirir", () => {
  const out = profileSchema.parse({
    alias: "  Ring   Kedisi ",
    avatarId: "kirpi",
    interests: ["kitap", "kahve", "oyun"],
    budgetTier: "TIER_450_600",
  });
  assert.equal(out.alias, "Ring Kedisi");
});

test("rumuz önerisi en fazla 20 denemede sonlanır; hepsi doluysa rastgele sayı ekler", async () => {
  let calls = 0;
  const alias = await findFreeAlias(async () => {
    calls++;
    return true; // her şey dolu
  });
  assert.equal(calls, ALIAS_SUGGESTION_ATTEMPTS);
  assert.match(alias, / \d{4}$/);
  assert.ok(aliasStepSchema.safeParse({ alias, avatarId: "geyik" }).success, `şemadan geçmeli: ${alias}`);

  let firstFree = 0;
  const quick = await findFreeAlias(async () => ++firstFree < 3);
  assert.equal(firstFree, 3, "boş bulunca hemen döner");
  assert.doesNotMatch(quick, /\d/);
});

test("sayı ekli rumuzlar her zaman uzunluk sınırına sığar", () => {
  for (let i = 0; i < 500; i++) {
    const alias = generateSuffixedAlias();
    assert.ok(aliasStepSchema.safeParse({ alias, avatarId: "geyik" }).success, alias);
  }
});
