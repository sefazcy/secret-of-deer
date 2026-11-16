import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Countdown } from "@/features/event/countdown";
import { getPublicEventInfo } from "@/features/event/queries";
import { EVENT_SUMMARY } from "@/lib/constants";
import { formatDayLong } from "@/lib/format";

const STEPS = [
  { emoji: "✉️", title: "Hacettepe e-postanla doğrula", text: "Okul adresine gelen 6 haneli kodla kaydını tamamla." },
  { emoji: "🦊", title: "Rumuzunu ve ilgi alanlarını seç", text: "Gerçek adın hiç görünmez; herkes seni rumuzunla tanır." },
  { emoji: "🎯", title: "Akıllı eşleşmeni öğren", text: "Aynı bütçe bandında, en çok ortak ilgi alanına sahip biriyle eşleşirsin." },
  { emoji: "🎟️", title: "QR biletinle buluşmaya gel", text: "Hediyeni al, etkinlik günü QR kodunla kapıdan gir." },
];

const TRUST = [
  { emoji: "🎓", title: "Sadece Hacettepeliler", text: "@hacettepe.edu.tr ve @ogr.hacettepe.edu.tr zorunlu." },
  { emoji: "📱", title: "QR ile check-in", text: "Kapıda bilet kontrolü; hediyesiz gelen olmaz." },
  { emoji: "🔥", title: "Etkinlik sonrası veri imhası", text: "Tüm kişisel veriler etkinlikten sonra kalıcı olarak silinir." },
];

const FAQ = [
  {
    q: "Kime hediye alacağımı nasıl öğreneceğim?",
    a: "Kayıtlar kapandıktan sonra eşleştirme yapılır ve sana e-posta ile haber veririz. Panelinde eşleştiğin kişinin rumuzunu, ilgi alanlarını ve ipuçlarını görürsün.",
  },
  {
    q: "Bana hediye alan kişi benim gerçek adımı görecek mi?",
    a: "Hayır. Herkes birbirini yalnızca rumuz ve avatarla görür. E-posta adresin şifreli saklanır ve sadece sana bildirim göndermek için çözülür.",
  },
  {
    q: "Hediyeyi kime aldıysam o da bana mı alacak?",
    a: "Şart değil. Eşleşmeler tek yönlüdür: sen birine alırsın, başka biri sana alır.",
  },
  {
    q: "Bütçe aralığını neden seçiyorum?",
    a: "Sadece aynı bütçe bandındaki kişilerle eşleşirsin; böylece verdiğin ve aldığın hediye dengeli olur.",
  },
  {
    q: "Etkinliğe gelemezsem ne olur?",
    a: "Bir arkadaşın hediyesiz kalmasın diye katılım taahhüdü istiyoruz. Gelemeyeceksen lütfen en kısa sürede organizasyon ekibine haber ver.",
  },
];

export default async function HomePage() {
  const event = await getPublicEventInfo();

  return (
    <>
      <section className="bg-night text-snow">
        <div className="mx-auto max-w-5xl px-4 pb-12 pt-10 sm:pt-16">
          <p className="text-sm font-semibold uppercase tracking-widest text-gold">Hacettepe · Yılbaşı 2027</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Kampüsün gizli hediyeleşmesi:
            <br />
            <span className="text-gold">Beytepe Geyiği</span> 🦌
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/80">
            Ortak ilgi alanlarına göre eşleş, hediyeni hazırla, yılbaşı buluşmasında QR biletinle yerini al.
          </p>

          {event && event.phase === "REGISTRATION" && (
            <div className="mt-8 max-w-md">
              <p className="mb-2 text-sm text-white/70">Kayıtların kapanmasına kalan süre</p>
              <Countdown target={event.registrationClosesAt} />
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/kayit">Hacettepe E-postanla Katıl</ButtonLink>
            <ButtonLink href="#nasil-calisir" variant="ghost" className="border-white/20 bg-transparent text-snow hover:bg-white/10">
              Nasıl çalışır?
            </ButtonLink>
          </div>
        </div>
      </section>

      <section id="nasil-calisir" className="mx-auto max-w-5xl scroll-mt-16 px-4 py-12">
        <h2 className="text-2xl font-bold">4 adımda nasıl çalışır?</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Card className="h-full">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-surface-muted text-xl" aria-hidden>
                    {step.emoji}
                  </span>
                  <span className="text-sm font-semibold text-ink-muted">Adım {i + 1}</span>
                </div>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-ink-muted">{step.text}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-surface-muted">
        <div className="mx-auto grid max-w-5xl gap-4 px-4 py-10 sm:grid-cols-3">
          {TRUST.map((t) => (
            <div key={t.title} className="flex gap-3">
              <span className="text-2xl" aria-hidden>{t.emoji}</span>
              <div>
                <h3 className="font-semibold">{t.title}</h3>
                <p className="text-sm text-ink-muted">{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-2xl font-bold">Etkinlik detayları</h2>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Bütçe", value: EVENT_SUMMARY.budget },
            { label: "Lokasyon", value: event?.location ?? EVENT_SUMMARY.locations },
            { label: "Tarih", value: event ? formatDayLong(event.eventStartsAt) : "Yakında duyurulacak" },
            { label: "Saat", value: EVENT_SUMMARY.hours },
          ].map((item) => (
            <Card key={item.label}>
              <dt className="text-sm text-ink-muted">{item.label}</dt>
              <dd className="mt-1 text-lg font-semibold">{item.value}</dd>
            </Card>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16">
        <h2 className="text-2xl font-bold">Sıkça sorulan sorular</h2>
        <div className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
          {FAQ.map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {item.q}
                <span className="text-ink-muted transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </summary>
              <p className="mt-2 text-ink-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
