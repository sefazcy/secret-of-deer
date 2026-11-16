import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

type MailInput = { to: string; subject: string; text: string; html?: string };

let transporter: Transporter | undefined;

function smtp(): Transporter {
  if (transporter) return transporter;
  const e = env();
  transporter = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_PORT === 465,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASS } : undefined,
  });
  return transporter;
}

function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}

export async function sendMail(input: MailInput): Promise<void> {
  if (env().MAIL_MODE === "console") {
    // Geliştirme modu: gerçek gönderim yok, içerik terminale yazılır.
    console.info(
      `\n┌─ 📧 [MOCK MAIL] → ${maskEmail(input.to)}\n│ ${input.subject}\n│\n${input.text
        .split("\n")
        .map((l) => `│ ${l}`)
        .join("\n")}\n└──────────────────────────────\n`,
    );
    return;
  }
  await smtp().sendMail({ from: env().MAIL_FROM, ...input });
}

export async function sendOtpMail(to: string, code: string): Promise<void> {
  await sendMail({
    to,
    subject: `Beytepe Geyiği doğrulama kodun: ${code}`,
    text: [
      "Selam!",
      "",
      `Beytepe Geyiği kaydını tamamlamak için doğrulama kodun: ${code}`,
      "Kod 10 dakika geçerli. Bu isteği sen yapmadıysan bu e-postayı görmezden gelebilirsin.",
    ].join("\n"),
  });
}

/**
 * Eşleşme duyurusu. Gizlilik ve oltalama riskine karşı e-postada eşleşme bilgisi YOK;
 * öğrenci ayrıntıları yalnızca giriş yaptıktan sonra panelde görür.
 */
export async function sendMatchReadyMail(to: string, siteUrl: string): Promise<void> {
  await sendMail({
    to,
    subject: "🦌 Eşleşmen hazır! Hediye alacağın kişiyi öğren",
    text: [
      "Selam!",
      "",
      "Beytepe Geyiği eşleşmeleri açıklandı. Kime hediye alacağını görmek için panelin seni bekliyor:",
      `${siteUrl}/panel`,
      "",
      "Hediyeni aldığında panelden \"Hediyemi aldım\" onayını vermeyi unutma. 🎁",
    ].join("\n"),
  });
}
