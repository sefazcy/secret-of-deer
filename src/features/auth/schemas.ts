import { z } from "zod";
import { ALLOWED_EMAIL_DOMAINS, OTP } from "@/lib/constants";

export function isHacettepeEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

export const emailSchema = z
  .string({ error: "E-posta adresini yazmayı unuttun." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Bu bir e-posta adresine benzemiyor." }))
  .refine(isHacettepeEmail, {
    error: "Sadece @hacettepe.edu.tr veya @ogr.hacettepe.edu.tr adresleriyle katılabilirsin.",
  });

export const requestOtpSchema = z.object({
  email: emailSchema,
  kvkk: z.literal(true, { error: "Devam etmek için KVKK aydınlatma metnini onaylamalısın." }),
  pledge: z.literal(true, {
    error: "Etkinliğe hediyesiz gelmeyeceğine söz vermelisin 🎁",
  }),
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${OTP.length}}$`), { error: `Kod ${OTP.length} haneli bir sayı olmalı.` }),
});

export const staffLoginSchema = z.object({
  password: z.string().min(1, { error: "Şifreyi girmelisin." }),
});
