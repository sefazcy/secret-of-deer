import { randomInt } from "node:crypto";

/** Karışabilecek karakterler (0/O, 1/I/L) çıkarılmış alfabe — kapıda elle girişte hata azalır. */
export const TICKET_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const TICKET_LENGTH = 6;

export function generateTicketCode(): string {
  let code = "";
  for (let i = 0; i < TICKET_LENGTH; i++) code += TICKET_ALPHABET[randomInt(TICKET_ALPHABET.length)];
  return code;
}

export function normalizeTicketCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** QR içeriği: sürüm önekli, böylece check-in ekranı alakasız QR kodlarını ayırt eder. */
const QR_PREFIX = "BG1:";

export function ticketQrPayload(code: string): string {
  return `${QR_PREFIX}${code}`;
}

/** QR okumasından ya da elle girişten bilet kodunu çıkarır; geçersizse null. */
export function parseTicketInput(text: string): string | null {
  const raw = text.trim().toUpperCase();
  const body = raw.startsWith(QR_PREFIX) ? raw.slice(QR_PREFIX.length) : raw;
  const code = normalizeTicketCode(body);
  if (code.length !== TICKET_LENGTH) return null;
  return [...code].every((ch) => TICKET_ALPHABET.includes(ch)) ? code : null;
}
