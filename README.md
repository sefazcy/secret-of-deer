# 🦌 Beytepe Geyiği

Hacettepe Üniversitesi öğrencilerine özel, ilgi alanı + bütçe bazlı eşleştiren, QR biletli yılbaşı hediyeleşme platformu. Ürün gereksinimleri: [`CLAUDE.md`](CLAUDE.md).

**Yığın:** Next.js 16 (App Router, Cache Components, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 7 (PostgreSQL · @prisma/adapter-pg) · Zod 4 · iron-session · Nodemailer · sonner · qrcode.react

## Hızlı başlangıç

```bash
npm install                 # postinstall → prisma generate
cp .env.example .env        # ardından: npm run secrets çıktısını .env'e yapıştır, şifreleri ve DATABASE_URL'i doldur
npm run db:migrate          # şemayı PostgreSQL'e uygula (yerel Postgres ya da ücretsiz bir Neon/Supabase dalı)
npm run db:seed             # etkinlik ayarları  (demo profiller için: SEED_DEMO=1 npm run db:seed)
npm run dev                 # http://localhost:3000
```

Geliştirmede `MAIL_MODE="console"` iken OTP kodları e-posta yerine **terminale** yazılır. Bu mod üretimde (`NODE_ENV=production`) hem sunucu başlarken hem gönderim anında reddedilir.

| Komut | Açıklama |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` / `test` | Tip kontrolü, ESLint, birim + entegrasyon testleri (node:test + tsx; entegrasyon testleri her test için süreç içi geçici bir PostgreSQL (PGlite) açar ve uygulamayla aynı `@prisma/adapter-pg` sürücüsünü kullanır; `DATABASE_URL`'e dokunmaz. `TEST_DATABASE_URL` verilirse o sunucuda geçici şemalarla çalışır) |
| `npm run db:migrate` / `db:seed` / `db:studio` / `db:reset` | Prisma (geliştirme) |
| `npm run db:deploy` | Üretim veritabanına bekleyen migration'ları uygular (`prisma migrate deploy`) |
| `npm run secrets` | Yeni rastgele anahtarlar üretir |
| `npm run dev:phase -- MATCHED` | (Yalnızca geliştirme) Fazı değiştirir: `REGISTRATION`, `MATCHED` (eşleştirmeyi çalıştırır), `EVENT_DAY` |
| `GET /api/health` | Uygulama + veritabanı sağlık kontrolü |

## Klasör yapısı

```
prisma/
  schema.prisma          # Kimlik ve anonim profil katmanları (FK yok, HMAC köprüsü)
  migrations/            # SQL migration geçmişi
  seed.ts
prisma.config.ts         # Prisma 7 CLI ayarı (DATABASE_URL buradan okunur)
src/
  app/                   # Rotalar (yalnızca sayfa kompozisyonu, iş mantığı yok)
    page.tsx             #   /               ana sayfa
    gizlilik-kvkk/       #   /gizlilik-kvkk
    kayit/               #   /kayit          e-posta + OTP
    profil-olustur/      #   /profil-olustur 3 adımlı sihirbaz
    panel/               #   /panel          öğrenci paneli (faz 1-2-3)
    admin/               #   /admin, /admin/check-in, /admin/giris
    api/health/          #   sağlık kontrolü
  features/              # Alan modülleri: şema, sorgu, aksiyon, bileşen bir arada
    auth/                #   OTP ve oturum (schemas.ts)
    profile/             #   profil şemaları, rumuz üretici
    matching/            #   eşleştirme algoritması + testleri, service.ts (DB'ye yazma)
    event/               #   etkinlik ayarları sorguları, geri sayım, phase.ts (atomik faz kilidi + denetim kaydı)
    panel/               #   öğrenci paneli: faz bazlı veri, eşleşme kartı, QR bilet
    admin/               #   ekip girişi, yetki (dal.ts), KPI, joker, eşleştirme/imha aksiyonları
    checkin/             #   kapı check-in aksiyonları, kamera QR tarayıcı (BarcodeDetector → jsQR)
  components/            # Paylaşılan UI (ui/, layout/, providers/)
  lib/                   # Altyapı: db, env, crypto, session, mail, ticket, constants
  generated/prisma/      # Prisma client çıktısı (git'e girmez)
  test/                  # Test yardımcıları (geçici veritabanı, test ortam değişkenleri)
  instrumentation.ts     # Sunucu başlarken ortam doğrulaması (hatalıysa sunucu açılmaz)
  proxy.ts               # İyimser yönlendirme (Next 16'da middleware → proxy)
```

**Katmanlar:** Her özellikte `service.ts` veritabanı iş mantığını `db` parametresiyle içerir (entegrasyon testleri doğrudan çağırır); `actions.ts` yalnızca yetki, oturum, önbellek ve kullanıcı mesajlarını ekleyen ince sunucu aksiyonudur.

**Kural:** `lib/` hiçbir `features/` modülünü import etmez; `features/` birbirini yalnızca dışa açık dosyalar üzerinden kullanır; `app/` sadece birleştirir. `server-only` işaretli modüller (`env`, `crypto`, `session`, `mail`) istemciye sızamaz.

## Güvenlik modeli (KVKK)

- **E-posta:** `email_hash` = HMAC-SHA256(pepper, e-posta). Spesifikasyondaki düz SHA-256 yerine anahtarlı HMAC kullanılıyor, çünkü öğrenci adresleri tahmin edilebilir ve düz özet sözlük saldırısıyla çözülebilir. `encrypted_email` = AES-256-GCM.
- **OTP:** Kodun kendisi değil, HMAC özeti saklanır. 10 dk geçerli, kod başına en fazla 5 yanlış deneme (veritabanında atomik sayaç). E-posta konu satırında kod yer almaz.
- **OTP hız sınırları (çok katmanlı, `lib/constants.ts → OTP_RATE_LIMITS`):**

  | İşlem | IP bazlı | E-posta kimliği bazlı (anahtar: e-postanın HMAC özeti) |
  | --- | --- | --- |
  | Kod isteme | 15 dk'da 10 | 60 sn bekleme (veritabanında atomik; eşzamanlı isteklerden yalnızca biri kod üretir ve kotadan düşer) + 24 saatte 5 kod |
  | Kod doğrulama | 15 dk'da 30 | 1 saatte 15 deneme (yeni kod istense de sıfırlanmaz) + kod başına 5 |
- **Katman ayrımı:** `ParticipantProfile.identity_ref` = HMAC(`PROFILE_LINK_SECRET`, `AuthIdentity.profile_token`). Veritabanı tek başına sızarsa profil ile e-posta eşleştirilemez.
- **Ekip girişi (`/admin/giris`):** `ADMIN_PASSWORD` → tüm yönetim paneli, `CHECKIN_PASSWORD` → yalnızca `/admin/check-in`. Şifreler sabit zamanlı karşılaştırılır; IP başına 15 dakikada 10 deneme (bkz. "Hız sınırlayıcıyı ortak depoya taşımak"). Rol, şifreli oturum çerezinde tutulur; `proxy.ts` yalnızca iyimser kontrol yapar, asıl yetki her sayfa ve server action'da `requireStaff()` ile sunucuda denetlenir.
- **Admin:** Eşleşme listesi gösterilmez, sadece grup istatistikleri. Tek istisna jokerler: ekip üyesi oldukları için hediye alacakları kişi panelde görünür.
- **Bildirim e-postası:** Yalnızca "eşleşmen hazır, panele gir" der; kimin kime çıktığı e-postada yer almaz. Bağlantı için `SITE_URL` gerekir.
- **İmha:** "Etkinliği sonlandır" iki aşamalı onay ister (uyarı + `VERİLERİ İMHA ET` yazımı; sunucu da ifadeyi doğrular). Tek transaction'da `auth_identities`, `participant_profiles`, `profile_interests` ve `matches` tamamen silinir, faz `CLOSED` olur, ardından bu tablolarda `VACUUM FULL` ile silinen satırların disk üzerindeki izi temizlenir. Not: Barındırma sağlayıcısının otomatik yedekleri ve geri dönüş (PITR / dal geçmişi) kayıtları, sağlayıcının saklama süresi dolana kadar eski verileri içerebilir; KVKK aydınlatma metni ve sağlayıcı ayarları buna göre yapılandırılmalı (bkz. "Canlıya alma").
- **Oturum iptali:** Çerezde oturumun açıldığı dönem (`epoch`) tutulur; `event_settings.session_epoch` imhada 1 artar. Dönemi eşleşmeyen (imhadan önce açılmış ya da dönem bilgisi olmayan eski) tüm öğrenci ve ekip oturumları sunucu tarafında geçersiz sayılır (`getCurrentIdentity()`, `getStaffRole()`).
- **Denetim kaydı (`audit_logs`):** Eşleştirmenin kesinleşmesi, bilet modunun açılması ve veri imhası; yalnızca işlem türü, zaman damgası ve sayısal özet (`profiles=12 matches=12`) olarak yazılır. Kişisel veri içermez ve imhada silinmez.
- **Loglar:** Hiçbir log satırına OTP, şifre, oturum çerezi ya da düz e-posta yazılmaz. Hata loglarında hata mesajı değil yalnızca türü/kodu yer alır (`lib/log.ts → safeErrorSummary`), çünkü SMTP hataları alıcı adresini içerebilir. Tek istisna, yalnızca geliştirmede çalışan konsol e-posta modudur (maskeli adres + kod).
- **`decryptEmail`:** Çözmeden önce tam 3 parça, kanonik base64url, 12 bayt IV, 16 bayt etiket ve 1–254 bayt şifreli metin doğrulanır. Bozuk ya da manipüle edilmiş her girdi, ayrıntı vermeyen tek bir `EncryptedEmailError` ile reddedilir.

### Ortam doğrulaması

`src/lib/env-schema.ts`, sunucu başlarken (`src/instrumentation.ts`) çalışır; hata varsa sunucu istek kabul etmeden durur. Hata mesajları değerleri değil yalnızca değişken adlarını içerir.

- `SESSION_SECRET`, `EMAIL_ENCRYPTION_KEY`, `EMAIL_HASH_PEPPER`, `PROFILE_LINK_SECRET`, `ADMIN_PASSWORD`, `CHECKIN_PASSWORD`: minimum uzunluk, entropi tahmini ve farklı karakter sayısı kuralları; **hepsi birbirinden farklı** olmalı. `npm run secrets` çıktısı kuralları rahatça geçer.
- `SMTP_USER` ve `SMTP_PASS` ya ikisi birlikte girilir ya da ikisi de boş bırakılır.
- **Üretimde (`NODE_ENV=production`) ek olarak:** `MAIL_MODE=smtp`; `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` dolu; `MAIL_FROM` gerçek bir adres; `SITE_URL` `https://` ile başlayan ve localhost olmayan bir adres. Bu yüzden `npm start` geliştirme `.env` dosyasıyla bilerek açılmaz.

### Faz kilidi (yarış koşulları)

Fazı koşul alan her yazma (profil oluşturma/güncelleme, joker ekleme/çıkarma, eşleştirmeyi kesinleştirme, bilet modu, check-in ve geri alma, "hediyemi aldım") tek bir `db.$transaction` içinde **önce** `event_settings` satırını koşullu günceller (`src/features/event/phase.ts`):

```ts
await tx.eventSettings.updateMany({ where: { id: 1, phase: { in: allowed } }, data: { lockVersion: { increment: 1 } } });
// 0 satır → PhaseError (yanlış faz ya da ayar satırı yok)
```

Faz geçişleri de aynı kalıpla koşulludur: `updateMany({ where: { id: 1, phase: "MATCHED" }, data: { phase: "EVENT_DAY" } })`. PostgreSQL'de bu UPDATE satır kilidi alıp transaction sonuna kadar tutar; eşzamanlı bir yazma kilidi bekler ve (READ COMMITTED'da) koşulu satırın güncel hâli üzerinde yeniden değerlendirir. Sonuçlar:

- Eşleştirme, faz kilidini aldıktan sonra adayları okur ve yazar: araya yeni profil ya da joker **sızamaz**, aynı anda iki "kesinleştir"den yalnızca biri geçer.
- `event_settings` (id = 1) satırı yoksa hiçbir işlem varsayılan olarak `REGISTRATION` kabul edilmez; OTP, profil ve yönetim aksiyonları açık bir hatayla reddedilir (`npm run db:seed`).
- Check-in geri alma yalnızca `EVENT_DAY` fazında mümkündür.

### Hız sınırlayıcıyı ortak depoya (Redis) taşımak

`src/lib/rate-limit.ts` sayaçları `RateLimitStore` arayüzünün arkasında tutar. Varsayılan `MemoryRateLimitStore` tek süreç için yeterlidir; birden çok sunucu örneğinde sayaçlar paylaşılmaz. Ortak depoya geçmek için arayüzü uygulayıp sunucu başlarken bir kez kaydetmek yeterli; çağıran kod değişmez:

```ts
// src/instrumentation.ts → register() içinde (ör. ioredis ile)
import Redis from "ioredis";
import { setRateLimitStore, type RateLimitStore } from "@/lib/rate-limit";

const redis = new Redis(process.env.REDIS_URL!);
const store: RateLimitStore = {
  async increment(key, windowMs) {
    const [[, count], , [, ttl]] = (await redis
      .multi()
      .incr(key)
      .pexpire(key, windowMs, "NX") // pencere yalnızca ilk artışta başlar
      .pttl(key)
      .exec()) as [[null, number], [null, number], [null, number]];
    return { count, resetAt: Date.now() + Math.max(0, ttl) };
  },
  async reset(key) {
    await redis.del(key);
  },
};
setRateLimitStore(store);
```

Anahtarlar `rl:<sınırlayıcı>:<anahtar>` biçimindedir; e-posta bazlı anahtarlar ham adres değil HMAC özetidir. IP, `x-forwarded-for` başlığından okunur (`src/lib/request.ts`); üretimde uygulama bu başlığı ezen güvenilir bir ters vekil arkasında çalışmalıdır.

## Eşleştirme

`src/features/matching/algorithm.ts`: Katılımcılar bütçe gruplarına ayrılır. Her grupta köşegeni (kendine atama) yasaklı Macar algoritmasıyla toplam ortak ilgi alanı maksimize edilir (O(n³)). Atama tek yönlüdür. Girdi önce karıştırıldığı için eşit skorlarda sonucu kayıt sırası belirlemez. Testler, sonucu kaba kuvvetle bulunan optimumla karşılaştırır.

## Canlıya alma (Vercel + Neon / Supabase)

**1. Veritabanı (Neon).** Proje `neon.ts` ile Neon'a bağlıdır (org/proje/dal: `production`). Değişkenleri yerel `.env`'e çekmek için:

```bash
npm i -g neon@latest
neon login                 # tarayıcıda oturum
neon env pull              # ya da: neon deploy (neon.ts'i uygular + değişkenleri çeker)
```

| Değişken | Değer | Kim kullanır |
| --- | --- | --- |
| `DATABASE_URL` | Neon havuzlu adres (`…-pooler.…neon.tech/…?sslmode=require`) | Uygulama: `src/lib/db.ts` (`pg` havuzu + `@prisma/adapter-pg`) |
| `DATABASE_URL_UNPOOLED` | Neon doğrudan adres | Prisma CLI: migrate, seed (`prisma.config.ts`; elle `DIRECT_URL` verilirse o önceliklidir) |

Supabase kullanılacaksa: `DATABASE_URL` = transaction pooler (`:6543/postgres?pgbouncer=true`), `DIRECT_URL` = doğrudan bağlantı (`:5432`).

Uygulama `sslmode=require` adresini sertifika ve ana makine doğrulamalı `verify-full` olarak kullanır. Vercel'de havuz `@vercel/functions` → `attachDatabasePool` ile Fluid compute'a kaydedilir (yalnızca Vercel çalışma zamanında).

**2. Şema ve başlangıç verisi** (`.env` Neon değişkenlerini içerirken):

```bash
npm run db:deploy   # migration'ları DATABASE_URL_UNPOOLED üzerinden uygular
npm run db:seed     # event_settings satırı (zorunlu; yoksa tüm işlemler reddedilir)
```

> `next build`, ana sayfayı önceden render ederken veritabanını okur. Vercel'deki ilk build'den **önce** migration uygulanmış olmalıdır.

Sonraki şema değişikliklerinde geliştirmede `npm run db:migrate -- --name <ad>` ile migration üretip commit edin, deploy öncesi `npm run db:deploy` çalıştırın.

**3. Vercel.** Projeyi içe aktarın; build komutu `package.json`'daki `prisma generate && next build`'dir. *Settings → Environment Variables* (Production) altına şunları girin (Vercel–Neon entegrasyonu ilk ikisini otomatik ekleyebilir): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `SESSION_SECRET`, `EMAIL_ENCRYPTION_KEY`, `EMAIL_HASH_PEPPER`, `PROFILE_LINK_SECRET` (`npm run secrets`), `ADMIN_PASSWORD`, `CHECKIN_PASSWORD`, `SITE_URL` (`https://…`), `MAIL_MODE=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Eksik ya da hatalı bir değer varsa sunucu açılmaz ve Vercel loglarında yalnızca değişken adı görünür (bkz. "Ortam doğrulaması"). İsteğe bağlı: `DATABASE_POOL_MAX` (örnek başına havuz boyutu, varsayılan 5).

**4. Notlar.**
- `EMAIL_ENCRYPTION_KEY`, `EMAIL_HASH_PEPPER` ve `PROFILE_LINK_SECRET` canlıya çıktıktan sonra **değiştirilmemeli**; değişirse kayıtlı e-postalar çözülemez ve profiller kimliklere bağlanamaz.
- Vercel birden çok örnek çalıştırır: süreç içi hız sınırı sayaçları örnekler arasında paylaşılmaz. Kesin sınır için "Hız sınırlayıcıyı ortak depoya taşımak" bölümündeki gibi Redis (ör. Upstash) bağlayın.
- Vercel `x-forwarded-for` başlığını kendisi ayarlar; IP bazlı sınırlar bu başlığa güvenir.
- Veri imhasından sonra sağlayıcı yedekleri ve PITR geçmişi için saklama süresini kısa tutun (Neon: *history retention*, Supabase: yedekler) ya da imha sonrası veritabanını/dalı tamamen silin.
