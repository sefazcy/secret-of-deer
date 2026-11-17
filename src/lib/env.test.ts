import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { estimateEntropyBits, parseEnv } from "./env-schema";
import { isConsoleMailAllowed } from "./mail";

function baseEnv(): Record<string, string | undefined> {
  return {
    NODE_ENV: "development",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/beytepe",
    SESSION_SECRET: randomBytes(32).toString("base64url"),
    EMAIL_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    EMAIL_HASH_PEPPER: randomBytes(32).toString("base64url"),
    PROFILE_LINK_SECRET: randomBytes(32).toString("base64url"),
    ADMIN_PASSWORD: "Yonetim-Sifresi-2026!",
    CHECKIN_PASSWORD: "Kapi-Ekibi-2026",
    SITE_URL: "http://localhost:3000",
    MAIL_MODE: "console",
  };
}

function prodEnv(): Record<string, string | undefined> {
  return {
    ...baseEnv(),
    NODE_ENV: "production",
    SITE_URL: "https://geyik.hacettepe.edu.tr",
    MAIL_MODE: "smtp",
    SMTP_HOST: "smtp.hacettepe.edu.tr",
    SMTP_USER: "geyik-bot",
    SMTP_PASS: "smtp-pass-xyz",
    MAIL_FROM: "Beytepe Geyiği <geyik@hacettepe.edu.tr>",
  };
}

function issuesOf(source: Record<string, string | undefined>): string[] {
  const r = parseEnv(source);
  return r.ok ? [] : r.issues;
}

test("geçerli geliştirme ve üretim yapılandırması kabul edilir", () => {
  assert.deepEqual(issuesOf(baseEnv()), []);
  assert.deepEqual(issuesOf(prodEnv()), []);
});

test("üretimde MAIL_MODE=console reddedilir", () => {
  const issues = issuesOf({ ...prodEnv(), MAIL_MODE: "console" });
  assert.ok(issues.some((i) => i.includes("MAIL_MODE=console")), issues.join("\n"));
  // Varsayılan da console olduğu için MAIL_MODE hiç verilmezse de reddedilmeli.
  assert.ok(issuesOf({ ...prodEnv(), MAIL_MODE: undefined }).some((i) => i.includes("MAIL_MODE")));
});

test("üretimde SITE_URL https ve localhost dışı olmalı", () => {
  for (const url of ["http://geyik.hacettepe.edu.tr", "https://localhost:3000", "https://127.0.0.1", undefined]) {
    assert.ok(
      issuesOf({ ...prodEnv(), SITE_URL: url }).some((i) => i.includes("SITE_URL")),
      `reddedilmeliydi: ${url}`,
    );
  }
  // Geliştirmede localhost serbest.
  assert.deepEqual(issuesOf({ ...baseEnv(), SITE_URL: "http://localhost:3000" }), []);
});

test("SMTP_USER ve SMTP_PASS birlikte girilmeli; boş string girilmemiş sayılır", () => {
  assert.ok(issuesOf({ ...baseEnv(), SMTP_USER: "kullanici" }).some((i) => i.includes("SMTP_USER ve SMTP_PASS")));
  assert.ok(issuesOf({ ...baseEnv(), SMTP_PASS: "sifre", SMTP_USER: "" }).some((i) => i.includes("SMTP_USER ve SMTP_PASS")));
  assert.deepEqual(issuesOf({ ...baseEnv(), SMTP_USER: "", SMTP_PASS: "" }), []);
});

test("üretimde eksik SMTP ayarları ve örnek MAIL_FROM reddedilir", () => {
  assert.ok(issuesOf({ ...prodEnv(), SMTP_HOST: "" }).length > 0);
  assert.ok(issuesOf({ ...prodEnv(), SMTP_USER: undefined, SMTP_PASS: undefined }).some((i) => i.includes("SMTP")));
  assert.ok(issuesOf({ ...prodEnv(), MAIL_FROM: undefined }).some((i) => i.includes("MAIL_FROM")));
});

test("anahtar ve şifreler birbirinden farklı olmalı", () => {
  const e = baseEnv();
  assert.ok(issuesOf({ ...e, CHECKIN_PASSWORD: e.ADMIN_PASSWORD }).some((i) => i.includes("aynı olamaz")));
  assert.ok(
    issuesOf({ ...e, EMAIL_HASH_PEPPER: e.SESSION_SECRET }).some((i) =>
      i.includes("SESSION_SECRET ve EMAIL_HASH_PEPPER aynı olamaz"),
    ),
  );
  const hex = randomBytes(32).toString("hex");
  assert.ok(issuesOf({ ...e, EMAIL_ENCRYPTION_KEY: hex, SESSION_SECRET: hex }).some((i) => i.includes("aynı olamaz")));
});

test("zayıf / düşük entropili değerler reddedilir, hata mesajı değeri sızdırmaz", () => {
  const e = baseEnv();
  const weak = [
    { SESSION_SECRET: "a".repeat(40) },
    { EMAIL_ENCRYPTION_KEY: "0".repeat(64) },
    { ADMIN_PASSWORD: "aaaaaaaaaaaa" },
    { ADMIN_PASSWORD: "123456789012" },
    { CHECKIN_PASSWORD: "1111111111" },
  ];
  for (const patch of weak) {
    const issues = issuesOf({ ...e, ...patch });
    const [key, value] = Object.entries(patch)[0]!;
    assert.ok(issues.some((i) => i.startsWith(`${key}:`)), `${key} zayıf kabul edilmeliydi`);
    assert.ok(!issues.join("\n").includes(value), "mesaj değeri içermemeli");
  }
  assert.ok(estimateEntropyBits(randomBytes(32).toString("base64url")) > 200);
  assert.equal(estimateEntropyBits(""), 0);
});

test("konsol e-posta modu yalnızca üretim dışında", () => {
  assert.equal(isConsoleMailAllowed("console", "development"), true);
  assert.equal(isConsoleMailAllowed("console", undefined), true);
  assert.equal(isConsoleMailAllowed("console", "production"), false);
  assert.equal(isConsoleMailAllowed("smtp", "development"), false);
});
