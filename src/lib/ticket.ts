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
