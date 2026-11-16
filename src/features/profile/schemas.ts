import { z } from "zod";
import {
  AVATAR_IDS,
  BUDGET_TIER_KEYS,
  INTEREST_LIMITS,
  INTEREST_SLUGS,
  TEXT_LIMITS,
} from "@/lib/constants";

// Türkçe harfler, rakam, boşluk, nokta, tire ve kesme işareti.
const ALIAS_PATTERN = /^[A-Za-zÇĞİÖŞÜçğıöşü0-9 .'\-]+$/;

/** Sihirbaz Adım 1 */
export const aliasStepSchema = z.object({
  alias: z
    .string()
    .trim()
    .min(TEXT_LIMITS.aliasMin, { error: `Rumuz en az ${TEXT_LIMITS.aliasMin} karakter olmalı.` })
    .max(TEXT_LIMITS.aliasMax, { error: `Rumuz en fazla ${TEXT_LIMITS.aliasMax} karakter olabilir.` })
    .regex(ALIAS_PATTERN, { error: "Rumuzda sadece harf, rakam ve boşluk kullanabilirsin." }),
  avatarId: z.enum(AVATAR_IDS, { error: "Bir avatar seç." }),
});

/** Sihirbaz Adım 2 */
export const interestsStepSchema = z.object({
  interests: z
    .array(z.enum(INTEREST_SLUGS))
    .min(INTEREST_LIMITS.min, { error: `En az ${INTEREST_LIMITS.min} ilgi alanı seçmelisin.` })
    .max(INTEREST_LIMITS.max, { error: `En fazla ${INTEREST_LIMITS.max} ilgi alanı seçebilirsin.` })
    .refine((list) => new Set(list).size === list.length, { error: "Aynı ilgi alanı iki kez seçilmiş." }),
  budgetTier: z.enum(BUDGET_TIER_KEYS, { error: "Bir bütçe aralığı seç." }),
});

/** Sihirbaz Adım 3 */
export const giftNotesStepSchema = z.object({
  giftHints: z
    .string()
    .trim()
    .max(TEXT_LIMITS.giftHints, { error: `İpuçları en fazla ${TEXT_LIMITS.giftHints} karakter olabilir.` })
    .default(""),
  giftExclusions: z
    .string()
    .trim()
    .max(TEXT_LIMITS.giftExclusions, {
      error: `Bu alan en fazla ${TEXT_LIMITS.giftExclusions} karakter olabilir.`,
    })
    .default(""),
});

export const profileSchema = aliasStepSchema.extend(interestsStepSchema.shape).extend(giftNotesStepSchema.shape);
export type ProfileInput = z.infer<typeof profileSchema>;
