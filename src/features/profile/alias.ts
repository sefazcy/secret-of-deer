// Hacettepe temalı rastgele rumuz üretici. Hem istemcide (buton) hem sunucuda kullanılabilir.

const PLACES = [
  "Beytepe",
  "Sıhhiye",
  "Kampüs",
  "Kütüphane",
  "Yemekhane",
  "Ring",
  "Göl Kenarı",
  "Amfi",
  "Kantin",
  "Final Haftası",
  "Kar Tanesi",
  "Laboratuvar",
] as const;

// İyelik ekli hâlleri — "Beytepe Tilkisi" gibi doğal tamlama için.
const CREATURES = [
  "Geyiği",
  "Tilkisi",
  "Baykuşu",
  "Sincabı",
  "Kirpisi",
  "Kedisi",
  "Kargası",
  "Pengueni",
  "Ayısı",
  "Tavşanı",
  "Martısı",
  "Kurdu",
] as const;

/** Rumuz için izin verilen en uzun değer (TEXT_LIMITS.aliasMax ile aynı). */
const ALIAS_MAX = 24;

/** [0, n) aralığında kriptografik rastgele tamsayı (tarayıcı ve Node'da Web Crypto). */
function randomBelow(n: number): number {
  // Modülo yanlılığını önlemek için reddetme örneklemesi.
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  do globalThis.crypto.getRandomValues(buf);
  while (buf[0]! >= limit);
  return buf[0]! % n;
}

function pick<T>(list: readonly T[]): T {
  return list[randomBelow(list.length)]!;
}

export function generateAlias(): string {
  return `${pick(PLACES)} ${pick(CREATURES)}`;
}

/**
 * Sonuna 4 haneli rastgele sayı eklenmiş rumuz. Uzunluk sınırını aşmamak için yalnızca
 * sayıyla birlikte sığan yer–canlı ikilileri arasından seçilir.
 */
export function generateSuffixedAlias(): string {
  const suffix = String(1000 + randomBelow(9000));
  const fits = PLACES.flatMap((p) => CREATURES.map((c) => `${p} ${c}`)).filter(
    (a) => a.length + 1 + suffix.length <= ALIAS_MAX,
  );
  return `${pick(fits)} ${suffix}`;
}

export const ALIAS_SUGGESTION_ATTEMPTS = 20;

/**
 * Boşta bir rumuz bulur; en fazla `ALIAS_SUGGESTION_ATTEMPTS` deneme yapar. Hepsi doluysa
 * kriptografik rastgele sayı ekli bir rumuz döndürüp kesin olarak sonlanır (sınırsız döngü yok).
 * Kesin benzersizlik kayıt anında veritabanı kısıtı ve faz kilidiyle zaten garanti edilir.
 */
export async function findFreeAlias(isTaken: (alias: string) => Promise<boolean>): Promise<string> {
  for (let i = 0; i < ALIAS_SUGGESTION_ATTEMPTS; i++) {
    const candidate = generateAlias();
    if (!(await isTaken(candidate))) return candidate;
  }
  return generateSuffixedAlias();
}

/** Görüntülenecek biçim: baştaki/sondaki boşluklar atılır, art arda boşluklar teke iner. */
export function normalizeAlias(alias: string): string {
  return alias.trim().replace(/\s+/g, " ");
}

/** Benzersizlik anahtarı: Türkçe kurallarıyla küçük harf ("İ" → "i", "I" → "ı"). */
export function aliasKey(alias: string): string {
  return normalizeAlias(alias).toLocaleLowerCase("tr-TR");
}
