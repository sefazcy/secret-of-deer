// İstemci ve sunucu tarafında ortak kullanılan sabitler. Gizli bilgi İÇERMEZ.

export const ALLOWED_EMAIL_DOMAINS = ["hacettepe.edu.tr", "ogr.hacettepe.edu.tr"] as const;

export const OTP = {
  length: 6,
  ttlMinutes: 10,
  resendSeconds: 60,
  maxAttempts: 5,
} as const;

export const BUDGET_TIERS = {
  TIER_300_450: { label: "300–450 TL", min: 300, max: 450 },
  TIER_450_600: { label: "450–600 TL", min: 450, max: 600 },
} as const;
export type BudgetTierKey = keyof typeof BUDGET_TIERS;
export const BUDGET_TIER_KEYS = Object.keys(BUDGET_TIERS) as BudgetTierKey[];

export const INTEREST_LIMITS = { min: 3, max: 7 } as const;

export const INTERESTS = [
  { slug: "kitap", label: "Kitap", emoji: "📚" },
  { slug: "kahve", label: "Kahve", emoji: "☕" },
  { slug: "oyun", label: "Oyun", emoji: "🎮" },
  { slug: "muzik", label: "Müzik", emoji: "🎧" },
  { slug: "yazilim", label: "Yazılım", emoji: "💻" },
  { slug: "sinema", label: "Sinema", emoji: "🎬" },
  { slug: "tiyatro", label: "Tiyatro", emoji: "🎭" },
  { slug: "cizim", label: "Çizim", emoji: "🎨" },
  { slug: "kutu-oyunlari", label: "Kutu Oyunları", emoji: "🎲" },
  { slug: "spor", label: "Spor", emoji: "⚽" },
  { slug: "bilim-kurgu", label: "Bilim Kurgu", emoji: "🚀" },
  { slug: "anime", label: "Anime", emoji: "🍙" },
  { slug: "fotograf", label: "Fotoğraf", emoji: "📷" },
  { slug: "doga", label: "Doğa & Kamp", emoji: "🏕️" },
  { slug: "yemek", label: "Yemek", emoji: "🍳" },
  { slug: "el-isi", label: "El İşi", emoji: "🧶" },
] as const;
export type InterestSlug = (typeof INTERESTS)[number]["slug"];
export const INTEREST_SLUGS = INTERESTS.map((i) => i.slug) as [InterestSlug, ...InterestSlug[]];

export const AVATARS = [
  { id: "geyik", label: "Geyik", emoji: "🦌" },
  { id: "tilki", label: "Tilki", emoji: "🦊" },
  { id: "baykus", label: "Baykuş", emoji: "🦉" },
  { id: "sincap", label: "Sincap", emoji: "🐿️" },
  { id: "kirpi", label: "Kirpi", emoji: "🦔" },
  { id: "penguen", label: "Penguen", emoji: "🐧" },
  { id: "ayi", label: "Ayı", emoji: "🐻" },
  { id: "tavsan", label: "Tavşan", emoji: "🐰" },
] as const;
export type AvatarId = (typeof AVATARS)[number]["id"];
export const AVATAR_IDS = AVATARS.map((a) => a.id) as [AvatarId, ...AvatarId[]];

export const TEXT_LIMITS = {
  aliasMin: 3,
  aliasMax: 24,
  giftHints: 250,
  giftExclusions: 150,
} as const;

/** Ana sayfadaki statik etkinlik özeti. Tarih ve konum EventSettings tablosundan gelir. */
export const EVENT_SUMMARY = {
  budget: "300–600 TL",
  locations: "Beytepe / Kızılay",
  hours: "18.00 – 20.00",
} as const;
