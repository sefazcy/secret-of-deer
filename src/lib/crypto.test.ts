import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import * as c from "./crypto";

// Testler gerçek .env'e dokunmasın diye geçici anahtarlar. (env() ilk çağrıda okunduğu için
// import'tan sonra atamak yeterli.)
Object.assign(process.env, {
  DATABASE_URL: "postgresql://unused@localhost:5432/unused",
  SESSION_SECRET: randomBytes(32).toString("base64url"),
  EMAIL_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  EMAIL_HASH_PEPPER: randomBytes(32).toString("base64url"),
  PROFILE_LINK_SECRET: randomBytes(32).toString("base64url"),
  ADMIN_PASSWORD: "Test-Admin-Password-2026!",
  CHECKIN_PASSWORD: "Kapi-Ekibi-2026",
});

test("e-posta şifreleme gidiş-dönüş çalışır ve her seferinde farklı çıktı üretir", () => {
  const a = c.encryptEmail("Ali.Veli@ogr.hacettepe.edu.tr");
  const b = c.encryptEmail("ali.veli@ogr.hacettepe.edu.tr");
  assert.notEqual(a, b, "rastgele IV");
  assert.equal(c.decryptEmail(a), "ali.veli@ogr.hacettepe.edu.tr");
});

test("değiştirilmiş şifreli metin reddedilir (GCM bütünlük kontrolü)", () => {
  const [iv, tag, ct] = c.encryptEmail("x@hacettepe.edu.tr").split(".");
  const flipped = Buffer.from(ct!, "base64url");
  flipped[0]! ^= 1;
  assert.throws(() => c.decryptEmail([iv, tag, flipped.toString("base64url")].join(".")));
});

test("e-posta özeti büyük/küçük harf ve boşluktan etkilenmez", () => {
  assert.equal(c.hashEmail("  Ali@Hacettepe.edu.tr "), c.hashEmail("ali@hacettepe.edu.tr"));
  assert.notEqual(c.hashEmail("ali@hacettepe.edu.tr"), c.hashEmail("veli@hacettepe.edu.tr"));
});

test("OTP 6 haneli rakam ve özeti kimliğe bağlı", () => {
  for (let i = 0; i < 200; i++) assert.match(c.generateOtp(), /^\d{6}$/);
  assert.notEqual(c.hashOtp("id-1", "123456"), c.hashOtp("id-2", "123456"));
  assert.ok(c.safeEqual(c.hashOtp("id-1", "123456"), c.hashOtp("id-1", "123456")));
  assert.ok(!c.safeEqual("abc", "abcd"));
});

test("bozuk ya da manipüle edilmiş şifreli e-posta güvenli ve tek tip hatayla reddedilir", () => {
  const valid = c.encryptEmail("ali@ogr.hacettepe.edu.tr");
  const [iv, tag, ct] = valid.split(".") as [string, string, string];
  const b64 = (n: number) => randomBytes(n).toString("base64url");
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const nonCanonical = (part: string) => {
    const last = ALPHABET.indexOf(part.at(-1)!);
    const mutated = part.slice(0, -1) + ALPHABET[last ^ 1];
    assert.deepEqual(Buffer.from(mutated, "base64url"), Buffer.from(part, "base64url"), "aynı baytlar");
    return mutated;
  };

  const bad: Array<[string, string]> = [
    ["boş", ""],
    ["tek parça", iv],
    ["iki parça", `${iv}.${tag}`],
    ["dört parça", `${valid}.${ct}`],
    ["boş parça", `${iv}..${ct}`],
    ["boş şifreli metin", `${iv}.${tag}.`],
    ["base64 dışı karakter", `${iv}.${tag}.${ct}!`],
    ["standart base64 (+/=)", `${iv}.${tag}.${Buffer.from(ct, "base64url").toString("base64")}+`],
    // Etiket 16 bayt = 22 karakter; son karakterin alt 4 biti kullanılmaz. Bunları değiştirmek AYNI baytlara
    // çözülen ama farklı yazılan bir metin üretir — kanonik kontrol olmasa çözme başarılı olurdu.
    ["kanonik olmayan base64url", `${iv}.${nonCanonical(tag)}.${ct}`],
    ["kısa IV (8 bayt)", `${b64(8)}.${tag}.${ct}`],
    ["uzun IV (16 bayt)", `${b64(16)}.${tag}.${ct}`],
    ["kısaltılmış etiket (4 bayt)", `${iv}.${b64(4)}.${ct}`],
    ["uzun etiket (32 bayt)", `${iv}.${b64(32)}.${ct}`],
    ["aşırı uzun şifreli metin", `${iv}.${tag}.${b64(300)}`],
    ["aşırı uzun girdi", "a".repeat(5000)],
    ["yanlış etiket", `${iv}.${b64(16)}.${ct}`],
  ];
  for (const [name, payload] of bad) {
    assert.throws(
      () => c.decryptEmail(payload),
      (err: unknown) => err instanceof c.EncryptedEmailError && err.message === "Şifreli e-posta çözülemedi.",
      name,
    );
  }
  // @ts-expect-error — çalışma zamanında string olmayan girdi
  assert.throws(() => c.decryptEmail(undefined), c.EncryptedEmailError);
  assert.equal(c.decryptEmail(valid), "ali@ogr.hacettepe.edu.tr", "geçerli girdi hâlâ çözülür");
});
