import { test } from "node:test";
import assert from "node:assert/strict";
import { TICKET_ALPHABET, generateTicketCode, parseTicketInput, ticketQrPayload } from "./ticket";

test("bilet kodu 6 karakter ve karışabilen karakter içermez", () => {
  for (let i = 0; i < 500; i++) {
    const code = generateTicketCode();
    assert.equal(code.length, 6);
    for (const ch of code) assert.ok(TICKET_ALPHABET.includes(ch), ch);
    assert.doesNotMatch(code, /[01ILO]/);
  }
});

test("QR içeriği ve elle giriş aynı koda çözülür", () => {
  const code = generateTicketCode();
  assert.equal(parseTicketInput(ticketQrPayload(code)), code);
  assert.equal(parseTicketInput(code.toLowerCase()), code);
  assert.equal(parseTicketInput(` ${code.slice(0, 3)}-${code.slice(3)} `), code);
});

test("geçersiz girişler reddedilir", () => {
  for (const bad of ["", "ABC", "ABCDEFG", "https://example.com", "BG1:", "ABCD10", "BG2:ABCDEF"]) {
    assert.equal(parseTicketInput(bad), null, bad);
  }
});
