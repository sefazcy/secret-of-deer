# Proje: Beytepe Geyiği (Hacettepe Üniversitesi Yılbaşı Hediyeleşme Platformu)

## 1. Proje Özeti ve Amacı
Bu proje, yalnızca Hacettepe Üniversitesi öğrencilerinin katılabileceği, ortak ilgi alanlarına ve belirlenen bütçe aralıklarına göre eşleştirme yapan, toplu yüz yüze buluşma destekli (QR biletli) güvenli bir Yılbaşı Hediyeleşme (Secret Santa) web uygulamasıdır.

### Temel Hedefler & Çözülen Problemler
- **Ekilme (No-Show) Önleme:** Toplu fiziksel buluşmada kapıda QR kod ile check-in yapılır ve "Hediyemi Aldım" ön onayı takip edilir.
- **Sadece Hacettepeliler:** `@hacettepe.edu.tr` ve `@ogr.hacettepe.edu.tr` uzantılı e-postalara gönderilen 6 haneli OTP (tek kullanımlık şifre) ile doğrulama zorunludur.
- **Gizlilik ve Anonimlik (KVKK):** Öğrenciler birbirini gerçek isimleriyle değil, seçtikleri **Rumuz (Alias)** ve avatar ile görür. Gerçek kimlik/e-posta verileri ile profil/eşleşme verileri mimari olarak ayrıştırılmalıdır. Etkinlik sonrası tüm kişisel veriler tek tuşla kalıcı olarak imha edilecektir.
- **Akıllı Eşleştirme:** Öğrenciler aynı bütçe bandında (300-450 TL veya 450-600 TL) ve ortak ilgi alanı etiketleri maksimum kesişecek şekilde eşleştirilir.

---

## 2. Teknoloji Yığını Tercihleri (Tech Stack)
- **Mimari:** Modern, hızlı, mobil öncelikli (mobile-first) Full-Stack Web Uygulaması (Önerilen: Next.js App Router + TypeScript + Tailwind CSS + Prisma ORM + PostgreSQL veya SQLite/Supabase).
- **UI/UX Dili:** Kış ve kampüs temalı, temiz, güven veren arayüz (Koyu lacivert/gece mavisi veya sıcak kış yeşili, kırık beyaz arka plan, yılbaşı kırmızısı/altın vurgu renkleri).
- **E-posta Gönderimi:** OTP doğrulama kodları ve eşleşme bildirimleri için SMTP / Resend / Nodemailer entegrasyonu (Geliştirme ortamında OTP kodunu konsola yazdıran mock servis aktif olmalı).
- **QR Kod:** Kullanıcı panelinde benzersiz QR üretimi (`qrcode.react`) ve admin check-in ekranında kamera/manuel kod doğrulama.

---

## 3. Güvenlik ve Veritabanı Mimarisi (Kritik Kurallar)
Siber güvenlik ve KVKK uyumluluğu gereği veriler iki mantıksal katmanda izole edilmelidir:

1. **Kimlik Katmanı (`AuthIdentity`):**
   - `id` (UUID)
   - `email_hash` (SHA-256 hash — aynı maille mükerrer kaydı önlemek için)
   - `encrypted_email` (AES-256 ile şifrelenmiş e-posta — yalnızca OTP ve eşleşme bildirimi atılırken çözülür)
   - `otp_code`, `otp_expires_at`, `is_verified`
   - `profile_token` (Profile tablosuyla köprü kuran anonimleştirilmiş referans anahtarı)

2. **Anonim Profil ve Etkinlik Katmanı (`ParticipantProfile`):**
   - `id` (UUID)
   - `alias` (Benzersiz Rumuz, örn: "Beytepe Tilkisi")
   - `avatar_id` (Hazır vektör avatar kodu)
   - `interests` (JSON/Array — Seçilen ilgi alanı etiketleri)
   - `budget_tier` (`TIER_300_450` | `TIER_450_600`)
   - `gift_hints` (Max 250 karakter hediye ipucu)
   - `gift_exclusions` (Max 150 karakter istemediği şeyler/alerji)
   - `is_gift_ready` (Boolean — "Hediyemi Aldım" onayı)
   - `ticket_code` (Benzersiz 6 haneli alfanümerik kod + QR verisi)
   - `is_checked_in` (Boolean — Etkinlik günü kapı girişi)

3. **Eşleşme Tablosu (`Matches`):**
   - `id`, `giver_profile_id`, `receiver_profile_id`, `common_interests_count`, `created_at`
   - *Kural:* A kişisi B'ye hediye alıyorsa, B kişisi A'ya almak zorunda değildir (kapalı döngü / derangement algoritması uygulanmalıdır; kimse kendisiyle eşleşemez).

---

## 4. Sayfa Haritası (Sitemap) ve Bileşen Gereksinimleri

### A. Herkese Açık Alan (Public)
1. **`/` (Ana Sayfa):**
   - Hero alanı: Başlık, kayıt kapanışına geri sayım sayacı, "Hacettepe E-postanla Katıl" CTA butonu.
   - 4 Adımda Nasıl Çalışır kartları.
   - Güven rozetleri (`@hacettepe.edu.tr` zorunluluğu, QR Check-in, Etkinlik Sonrası Veri İmhası).
   - Etkinlik detay özeti (Bütçe: 300-600 TL, Lokasyon: Beytepe/Kızılay, Saat: 18.00-20.00).
   - SSS (Sıkça Sorulan Sorular) Accordion.
2. **`/gizlilik-kvkk` (Aydınlatma Metni):**
   - Verilerin nasıl şifrelendiğini ve etkinlik sonrası nasıl kalıcı olarak silineceğini anlatan sade metin.

### B. Öğrenci Akışı (Student Flow)
3. **`/kayit` (E-posta & OTP Doğrulama):**
   - `@hacettepe.edu.tr` ve `@ogr.hacettepe.edu.tr` uzantı doğrulaması.
   - 6 haneli OTP giriş kutuları + 60 saniye tekrar gönder sayacı.
   - KVKK ve "Hediye almadan etkinliğe katılmayacağım" taahhüt onayı checkbox'ı.
4. **`/profil-olustur` (3 Adımlı Sihirbaz / Onboarding):**
   - **Adım 1:** Benzersiz Rumuz seçimi + "Rastgele Hacettepe Temalı Rumuz Üret" butonu + Avatar seçici.
   - **Adım 2:** İlgi alanı etiketleri (Min 3, Max 7 seçim: Kitap, Kahve, Oyun, Müzik, Yazılım, Sinema, Tiyatro, Çizim, Kutu Oyunları, Spor, Bilim Kurgu, Anime vb.) + Bütçe bandı seçimi (`300-450 TL` veya `450-600 TL`).
   - **Adım 3:** Hediye ipuçları ve alerji/istenmeyenler metin alanları.
5. **`/panel` (Dinamik Öğrenci Kontrol Paneli):**
   - **Faz 1 (Eşleşme Öncesi):** Kayıt onay rozeti, canlı toplam katılımcı sayacı, profil düzenleme imkanı.
   - **Faz 2 (Eşleşme Sonrası):** Hediye alınacak kişinin Rumuzu, avatarı, ortak kesişen ilgi alanlarının vurgulanmış etiketleri, bütçesi, ipuçları; **"Hediyemi Aldım, Hazırım"** onay butonu; etkinlik mekan/saat bilgisi.
   - **Faz 3 (Etkinlik Günü / Bilet Modu):** Üstte sabitlenen büyük **QR Kod** ve 6 haneli yedek giriş kodu.

### C. Yönetim ve Saha Operasyonu (Admin & Check-in)
6. **`/admin` (Yönetim Paneli — Admin şifresi/yetkisi ile korumalı):**
   - KPI Kartları: Doğrulanmış öğrenci sayısı, bütçe dağılımı, "Hediyemi Aldım" oranı, check-in oranı.
   - Eşleştirme Motoru: Bütçe gruplarında tek/çift kişi kontrolü, "Eşleştirmeyi Simüle Et" ve "Eşleştirmeyi Kesinleştir & Bildirim Gönder" aksiyonları. (Gizlilik gereği admin panelinde kimin kime çıktığı açık liste olarak gösterilmez, sadece sistem durumu ve başarı oranı gösterilir).
   - **"Etkinliği Sonlandır ve Kişisel Verileri İmha Et"** kritik aksiyon butonu (Çift onaylı).
7. **`/admin/check-in` (Saha QR Doğrulama Ekranı):**
   - Gönüllü ekibin mobil cihazlardan QR okutarak veya 6 haneli kodu girerek öğrenciyi "Giriş Yaptı" olarak işaretleyeceği hızlı ekran.

---

## 5. Eşleştirme Algoritması Kuralları
1. Katılımcıları seçtikleri `budget_tier` (300-450 TL ve 450-600 TL) gruplarına ayır.
2. Her grup içinde katılımcılar arası ortak ilgi alanı sayısına göre ağırlıklı graf/puanlama oluştur.
3. Kimsenin kendisiyle eşleşmediği (`giver != receiver`) ve maksimum ortak ilgi alanı skorunu sağlayan bir atama (derangement / weighted matching) üret.
4. Grupta tek sayıda kişi varsa admin paneline uyarı ver (ekipten bir gönüllü "joker" olarak havuza eklenir).

---

## 6. Geliştirme Kuralları (Claude Code İçin Talimatlar)
- Tüm arayüz metinleri, hata mesajları ve placeholder'lar doğal, samimi ve anlaşılır **Türkçe** olmalıdır.
- Mobil uyumluluk (Responsive Design) en yüksek önceliktir; öğrencilerin %90'ı siteye telefonundan girecektir.
- Her adımda form validasyonu (Zod vb.) ve kullanıcı dostu hata bildirimleri (Toast) kullanılmalıdır.
- Kod yazarken modüler dosya yapısı kullan ve her yeni özellikten sonra çalışır durumda olduğundan emin ol.
---

## 7. Teknik Notlar
- Komutlar, klasör yapısı ve güvenlik modeli: `README.md`
- Next.js 16 kuralları: @AGENTS.md
