import { test } from "node:test";
import assert from "node:assert/strict";
import { emailSchema, requestOtpSchema, verifyOtpSchema } from "./schemas";

test("yalnızca Hacettepe alan adları kabul edilir", () => {
  assert.equal(emailSchema.parse("  Ali@OGR.Hacettepe.edu.tr "), "ali@ogr.hacettepe.edu.tr");
  assert.ok(emailSchema.safeParse("hoca@hacettepe.edu.tr").success);
  for (const bad of ["ali@gmail.com", "ali@hacettepe.edu.tr.evil.com", "ali@fakehacettepe.edu.tr", "ali@", "ali"]) {
    assert.equal(emailSchema.safeParse(bad).success, false, bad);
  }
});

test("KVKK ve taahhüt onayı zorunlu", () => {
  const email = "a@ogr.hacettepe.edu.tr";
  assert.ok(requestOtpSchema.safeParse({ email, kvkk: true, pledge: true }).success);
  const r = requestOtpSchema.safeParse({ email, kvkk: false, pledge: false });
  assert.equal(r.success, false);
  assert.deepEqual(r.error!.issues.map((i) => i.path[0]).sort(), ["kvkk", "pledge"]);
});

test("kod 6 haneli rakam olmalı", () => {
  const email = "a@ogr.hacettepe.edu.tr";
  assert.ok(verifyOtpSchema.safeParse({ email, code: "012345" }).success);
  for (const code of ["12345", "1234567", "12a456", ""]) {
    assert.equal(verifyOtpSchema.safeParse({ email, code }).success, false, code);
  }
});
