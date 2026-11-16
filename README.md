# 🦌 Beytepe Geyiği

Hacettepe Üniversitesi öğrencilerine özel, ilgi alanı + bütçe bazlı eşleştiren, QR biletli yılbaşı hediyeleşme platformu. Ürün gereksinimleri: [`CLAUDE.md`](CLAUDE.md).

**Yığın:** Next.js 16 (App Router, Cache Components, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 7 (SQLite → PostgreSQL) · Zod 4 · iron-session · Nodemailer · sonner · qrcode.react

## Hızlı başlangıç

```bash
npm install                 # postinstall → prisma generate
cp .env.example .env        # ardından: npm run secrets çıktısını .env'e yapıştır, şifreleri doldur
npm run db:migrate          # şemayı uygula (dev.db oluşur)
npm run db:seed             # etkinlik ayarları  (demo profiller için: SEED_DEMO=1 npm run db:seed)
npm run dev                 # http://localhost:3000
```

Geliştirmede `MAIL_MODE="console"` iken OTP kodları e-posta yerine **terminale** yazılır.

| Komut | Açıklama |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` / `test` | Tip kontrolü, ESLint, birim testler (node:test + tsx) |
| `npm run db:migrate` / `db:seed` / `db:studio` / `db:reset` | Prisma |
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
    event/               #   etkinlik ayarları sorguları, geri sayım
    panel/               #   öğrenci paneli: faz bazlı veri, eşleşme kartı, QR bilet
    admin/               #   ekip girişi, yetki (dal.ts), KPI, joker, eşleştirme/imha aksiyonları
    checkin/             #   kapı check-in aksiyonları, kamera QR tarayıcı (BarcodeDetector → jsQR)
  components/            # Paylaşılan UI (ui/, layout/, providers/)
  lib/                   # Altyapı: db, env, crypto, session, mail, ticket, constants
  generated/prisma/      # Prisma client çıktısı (git'e girmez)
  proxy.ts               # İyimser yönlendirme (Next 16'da middleware → proxy)
```

**Kural:** `lib/` hiçbir `features/` modülünü import etmez; `features/` birbirini yalnızca dışa açık dosyalar üzerinden kullanır; `app/` sadece birleştirir. `server-only` işaretli modüller (`env`, `crypto`, `session`, `mail`) istemciye sızamaz.

## Güvenlik modeli (KVKK)

- **E-posta:** `email_hash` = HMAC-SHA256(pepper, e-posta). Spesifikasyondaki düz SHA-256 yerine anahtarlı HMAC kullanılıyor, çünkü öğrenci adresleri tahmin edilebilir ve düz özet sözlük saldırısıyla çözülebilir. `encrypted_email` = AES-256-GCM.
- **OTP:** Kodun kendisi değil, HMAC özeti saklanır. 10 dk geçerli, en fazla 5 deneme, 60 sn tekrar gönderme aralığı (`lib/constants.ts`).
- **Katman ayrımı:** `ParticipantProfile.identity_ref` = HMAC(`PROFILE_LINK_SECRET`, `AuthIdentity.profile_token`). Veritabanı tek başına sızarsa profil ile e-posta eşleştirilemez.
- **Ekip girişi (`/admin/giris`):** `ADMIN_PASSWORD` → tüm yönetim paneli, `CHECKIN_PASSWORD` → yalnızca `/admin/check-in`. Şifreler sabit zamanlı karşılaştırılır; IP başına 15 dakikada 10 deneme (süreç içi sayaç, çok örnekli dağıtımda Redis'e taşınmalı). Rol, şifreli oturum çerezinde tutulur; `proxy.ts` yalnızca iyimser kontrol yapar, asıl yetki her sayfa ve server action'da `requireStaff()` ile sunucuda denetlenir.
- **Admin:** Eşleşme listesi gösterilmez, sadece grup istatistikleri. Tek istisna jokerler: ekip üyesi oldukları için hediye alacakları kişi panelde görünür.
- **Bildirim e-postası:** Yalnızca "eşleşmen hazır, panele gir" der; kimin kime çıktığı e-postada yer almaz. Bağlantı için `SITE_URL` gerekir.
- **İmha:** "Etkinliği sonlandır" iki aşamalı onay ister (uyarı + `VERİLERİ İMHA ET` yazımı; sunucu da ifadeyi doğrular). Tek transaction'da `auth_identities`, `participant_profiles`, `profile_interests` ve `matches` tamamen silinir, faz `CLOSED` olur, ardından `VACUUM` ile silinen satırların dosyadaki izi temizlenir.

## Eşleştirme

`src/features/matching/algorithm.ts`: Katılımcılar bütçe gruplarına ayrılır. Her grupta köşegeni (kendine atama) yasaklı Macar algoritmasıyla toplam ortak ilgi alanı maksimize edilir (O(n³)). Atama tek yönlüdür. Girdi önce karıştırıldığı için eşit skorlarda sonucu kayıt sırası belirlemez. Testler, sonucu kaba kuvvetle bulunan optimumla karşılaştırır.

## PostgreSQL'e geçiş

1. `prisma/schema.prisma` → `provider = "postgresql"`
2. `npm i @prisma/adapter-pg pg` ve `src/lib/db.ts` içinde `PrismaBetterSqlite3` yerine `PrismaPg`
3. `.env` → `DATABASE_URL="postgresql://..."`, ardından eski SQLite migration'larını silip `npm run db:migrate -- --name init`
