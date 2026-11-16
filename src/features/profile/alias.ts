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

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

export function generateAlias(): string {
  return `${pick(PLACES)} ${pick(CREATURES)}`;
}

/** Görüntülenecek biçim: baştaki/sondaki boşluklar atılır, art arda boşluklar teke iner. */
export function normalizeAlias(alias: string): string {
  return alias.trim().replace(/\s+/g, " ");
}

/** Benzersizlik anahtarı: Türkçe kurallarıyla küçük harf ("İ" → "i", "I" → "ı"). */
export function aliasKey(alias: string): string {
  return normalizeAlias(alias).toLocaleLowerCase("tr-TR");
}
