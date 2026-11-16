/** İmha işleminin ikinci onayında yazılması gereken ifade (istemci ve sunucu ortak). */
export const PURGE_CONFIRMATION = "VERİLERİ İMHA ET";

export function isPurgeConfirmed(input: string): boolean {
  return input.trim().toLocaleUpperCase("tr-TR") === PURGE_CONFIRMATION;
}
