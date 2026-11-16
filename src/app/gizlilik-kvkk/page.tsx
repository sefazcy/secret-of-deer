import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Gizlilik & KVKK" };

const SECTIONS = [
  {
    title: "Hangi verileri topluyoruz?",
    body: [
      "Hacettepe e-posta adresin (yalnızca öğrenci olduğunu doğrulamak ve sana bildirim göndermek için).",
      "Seçtiğin rumuz, avatar, ilgi alanları, bütçe aralığı, hediye ipuçları ve istemediğin şeyler.",
      "Etkinlik günü kapı girişi yapıp yapmadığın ve “Hediyemi aldım” onayın.",
    ],
  },
  {
    title: "Verilerini nasıl koruyoruz?",
    body: [
      "E-posta adresin AES-256 ile şifrelenmiş olarak saklanır; sadece doğrulama kodu ve eşleşme bildirimi gönderilirken çözülür.",
      "Kimlik bilgilerin ile profil bilgilerin veritabanında ayrı tablolarda tutulur ve doğrudan birbirine bağlı değildir. Eşleşmeler yalnızca rumuzlar üzerinden yapılır.",
      "Organizasyon ekibi dahil kimse, yönetim panelinden kimin kime hediye aldığını göremez.",
    ],
  },
  {
    title: "Verilerin ne zaman silinir?",
    body: [
      "Etkinlik bittiğinde organizasyon ekibi “Verileri İmha Et” işlemini başlatır ve tüm kişisel veriler (e-posta, profil, eşleşmeler) kalıcı olarak silinir.",
      "Sadece kimseyle ilişkilendirilemeyen toplam sayılar (ör. kaç kişinin katıldığı) kalabilir.",
    ],
  },
  {
    title: "Hakların",
    body: [
      "KVKK’nın 11. maddesi kapsamında verilerine erişme, düzeltilmesini ya da silinmesini isteme hakkın vardır. Talebini organizasyon ekibine iletebilirsin.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PageShell
      title="Gizlilik ve KVKK Aydınlatma Metni"
      description="Kısa ve sade: neyi, neden topladığımızı ve etkinlikten sonra nasıl sildiğimizi anlatıyoruz."
    >
      {SECTIONS.map((s) => (
        <Card key={s.title}>
          <h2 className="text-lg font-semibold">{s.title}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-muted">
            {s.body.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Card>
      ))}
    </PageShell>
  );
}
