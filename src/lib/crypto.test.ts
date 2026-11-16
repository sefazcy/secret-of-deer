import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import * as c from "./crypto";

// Testler gerçek .env'e dokunmasın diye geçici anahtarlar. (env() ilk çağrıda okunduğu için
// import'tan sonra atamak yeterli.)
Object.assign(process.env, {
  DATABASE_URL: "file:./test.db",
  SESSION_SECRET: randomBytes(32).toString("base64url"),
  EMAIL_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  EMAIL_HASH_PEPPER: randomBytes(32).toString("base64url"),
  PROFILE_LINK_SECRET: randomBytes(32).toString("base64url"),
  ADMIN_PASSWORD: "test-admin-password",
  CHECKIN_PASSWORD: "test-checkin",
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
