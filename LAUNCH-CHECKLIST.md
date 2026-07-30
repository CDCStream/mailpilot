# Inbox Wingman — Lansman Yapılacaklar Listesi

> Son güncelleme: 29 Temmuz 2026
> Durum işaretleri: ✅ bitti · 🔄 devam ediyor · ⬜ bekliyor · 💡 opsiyonel

## 1. Lansman blokerleri (bunlar bitmeden gerçek kullanıcı alamayız)

- 🔄 **Google OAuth doğrulaması** — Başvuru 29 Tem'da gönderildi (branding + gmail.modify gerekçesi + demo video). Google'ın dönüş e-postası bekleniyor.
  - ⬜ **CASA Tier 2 sertifikasyonu** — Google'ın yönlendirme e-postası gelince denetçi firma seçilecek (TAC Security en yaygını, ~500-750$/yıl). Tarama + öz değerlendirme anketi.
- ⬜ **Paddle entegrasyonu** — CASA'ya geçerken paralel yapılacak.
  - ⬜ Sandbox hesabı aç (sandbox-login.paddle.com), API key + client token al
  - ⬜ Ürün/fiyatları API ile oluştur (Pilot, Wingman abonelikleri + kredi top-up)
  - ⬜ Stripe kodunu Paddle'a çevir: checkout overlay, webhook, portal, top-up, hesap silmede abonelik iptali
  - ⬜ Canlı Paddle hesabı + site onayı (1-3 iş günü), `BILLING_ENABLED=true`
- ⬜ **Production veritabanını temizleme** — Lansmandan hemen önce test verilerini sıfırla (`scripts/reset-all-data.mjs` hazır).
- ⬜ **Privacy, Terms, DPA sayfalarını güncelleme** — Paddle (merchant of record) geçişini yansıt; OpenAI alt işleyici listesi güncel mi kontrol et; effective date güncelle.
- ⬜ **Landing page'e son halini verme** — Metinlerin son okuması, ekran görüntülerinin güncel ürünle eşleşmesi, fiyat kartları Paddle fiyatlarıyla senkron.

## 2. Analitik & izleme

- ⬜ **Supabase kullanıcı event tablosu** — `events` tablosu: `id, user_id (nullable), anon_id, event, path, referrer, properties (jsonb), user_agent, country/region/city, created_at`. Page view + kritik aksiyonlar (signup, account_connected, brief_generated, checkout_started...). Vercel'in geo header'larından (`x-vercel-ip-country` vb.) ülke/şehir alınabilir, ücretsiz.
- ⬜ **GA4 bağlama** — Google Ads dönüşüm takibi için de gerekli (madde: Ads kampanyaları).
- ⬜ **Ahrefs** — Site Audit + Rank Tracker; GSC entegrasyonunu da bağla.
- 💡 **Sentry (backend hata izleme)** — Next.js SDK; server action ve Inngest hatalarını yakalar. Lansman sonrası ilk hafta için çok değerli.
- 💡 **Uptime monitoring** — UptimeRobot/BetterStack ile `/` ve `/api/health` ping'i; Vercel + Inngest kesintilerini erken haber verir. *(benim önerim)*

## 3. SEO / AEO / GEO (yapay zaka araçlarına görünürlük)

> Plan: outrank.so'nun 90 günlük SEO sprint'ine göre fazlandı (outrank.so/90-day-seo-sprint).

### Faz 0 — Lansman öncesi (hemen yapılabilir)

- ⬜ **Her sayfaya benzersiz meta** — title + 155 karakterlik description + OG image + Twitter card, sadece ana sayfa değil TÜM sayfalar. Title = ürün adı + ne işe yaradığı.
- ⬜ **Yapılandırılmış veri (JSON-LD)** — `SoftwareApplication` şeması (kategori: email productivity) + kilit sayfalara `FAQPage` şeması.
- ⬜ **Sitemap'i GSC + Bing Webmaster'a gönderme** — `sitemap.xml` üret (Next dosya konvansiyonu), GSC'ye gönder + en önemli 5 sayfa için elle "Request Indexing". Bing Webmaster'a GSC'den import et (ChatGPT aramasını Bing besliyor).
- ⬜ **İlk gün linki** — X/LinkedIn'den siteye gerçek trafik gönderen bir tanıtım postu; varsa başka bir mülkten (blog, newsletter) link.

### Faz 1 — Temel (1.-30. gün)

- ⬜ **Teknik denetim** — robots.txt bir şeyi yanlışlıkla engelliyor mu; canonical tag'ler (`/features` vs `/features/`); Core Web Vitals (LCP < 2.5s); tüm görsellere alt text; **login/dashboard/onboarding sayfalarına noindex**; sitemap temiz mi.
- ⬜ **Lighthouse skorlarını yükseğe çıkarma** — ana sayfa + kilit marketing sayfalarında Performance 90+, SEO/Accessibility/Best Practices 95+ hedefi (mobil öncelikli). pagespeed.web.dev ile ölç; tipik kazançlar: görsel boyutları/lazy loading, kullanılmayan JS, font yükleme (display: swap), LCP elementini preload. Her deploy sonrası tekrar ölç.
- ⬜ **robots.txt + llms.txt + llms-full.txt** — AI crawler'lara (GPTBot, ClaudeBot, PerplexityBot) izin ver; llms.txt'de ürün özeti, fiyatlar, karşılaştırmalar.
- ⬜ **Keyword evreni: 20-30 kazanılabilir kelime** — sadece ilk 3 sonucu DR<50 sitelerden olan kelimeler; öncelik sırası: solution-aware ("best ai email assistant", "fyxer alternative") → problem-aware ("how to organize gmail inbox") → brand-aware (kendiliğinden gelir).
- ⬜ **3 çekirdek sayfa** — Ana sayfa (H1'de birincil keyword), en spesifik use-case sayfası, **ilk karşılaştırma sayfası (vs Fyxer)** — karşılaştırma sayfaları en hızlı rank alan içerik.

### Faz 2 — İçerik motoru (31.-60. gün)

- ⬜ **outrank.so blog entegrasyonu** — `/blog` rotası; haftada 2-3 içerik.
- ⬜ **İçerik sırası (çoğu kurucunun tersine)** — 1) karşılaştırma/alternatif sayfaları (en yüksek dönüşüm) → 2) use-case sayfaları → 3) problem-aware blog → 4) düşünce liderliği.
- ⬜ **Repurpose kuralı** — her blog yazısı = 1 LinkedIn postu + 1 X thread'i.
- ⬜ **Backlink başlangıç paketi (60. güne 10 referring domain)** — Dizinler: Product Hunt, G2, Capterra, SaaSHub, AlternativeTo, Betalist. Topluluk: IndieHackers, Reddit. 1 güçlü misafir yazı (DR 40+). 2-3 kurucuyla karşılıklı link takası.
- 💡 **Programatik SEO** — `/alternatives/[rakip]` ve `/for/[meslek]` şablon sayfaları (avukatlar için, danışmanlar için, emlakçılar için...).

### Faz 3 — Otorite (61.-90. gün)

- ⬜ **8-20. sıradaki sayfaları güncelle** — GSC'de pozisyon 8-20 arası sayfalar en hızlı kazanç; derinlik + FAQ bölümü ekle.
- ⬜ **İlk içerik kümesi** — tek temada 5-7 birbirine linkli yazı + merkez pillar post (ör. "AI email management" kümesi).
- ⬜ **Featured snippet hedefleme** — soru bazlı kelimelerde 40-60 kelimelik net cevap paragrafları / numaralı listeler.
- ⬜ **AI arama uyarlamaları (AEO/GEO)** — her kavrama net tanım; her kilit sayfaya gerçek soru formatında FAQ; H2'leri soru olarak yaz ("What does Inbox Wingman do?"); güvenilir sitelerde ürün adı geçirme (entity mentions).
- ⬜ **90. gün denetimi** — GSC impressions/clicks, DR, top-100 ve top-10 kelime sayısı; başlangıçla karşılaştır.

## 4. Güven & Avrupa müşterileri

- ⬜ **Güven sinyalleri** — Mevcut: GDPR bölümü, DPA, data-request sayfası, alt işleyici listesi. Eklenebilecekler:
  - CASA rozeti (sertifika gelince security sayfasına)
  - "Verified by Google" ifadesi (doğrulama bitince)
  - Trust/security sayfasında şifreleme detayları (AES-256-GCM, TLS) — kısmen var, rozetlerle görselleştir
  - Footer'a "EU-ready: GDPR compliant, data deletable anytime" satırı
- 💡 **DMARC kaydı** — SPF + DKIM tamam, DMARC eksik: `_dmarc TXT "v=DMARC1; p=none; rua=mailto:..."`. Brief e-postalarının spam'e düşmemesi ve domain itibarı için. DNS Vercel'de, 1 dakikalık iş. *(benim önerim)*
- 💡 **Karşılama e-postası** — İlk bağlantıdan sonra "hoş geldin + ne beklemelisin" maili (Resend hazır). Aktivasyonu artırır. *(benim önerim)*

## 5. Büyüme

- ⬜ **Google Ads kampanyaları** — Önce GA4 + dönüşüm olayları (signup, subscribe) bağlanmalı. Başlangıç: marka + "fyxer alternative" + "ai email assistant" arama kampanyaları.
- 💡 **Ücretsiz araçlar (risksiz)** — SEO mıknatısı olarak: e-posta konu satırı test aracı, "email tone checker", imza oluşturucu gibi tek sayfalık araçlar `/tools` altında.
- 💡 **Product Hunt lansmanı** — Doğrulama bitip billing açılınca; social card + demo video zaten hazır olacak. *(benim önerim)*

## 6. Teknik borç / küçük işler *(benim önerilerim)*

- 💡 **404 / error sayfalarını markalama** — Şu an Next varsayılanı.
- 💡 **`/api/health` endpoint'i** — Uptime monitoring için basit DB ping'li sağlık kontrolü.
- 💡 **Supabase yedekleme kontrolü** — Otomatik yedek planda var mı doğrula; yoksa günlük `pg_dump` cron'u.
- 💡 **Rate limiting** — Public API rotalarına (özellikle auth callback ve webhook) basit istek sınırı.

---

## Sıra önerisi

1. **Şimdi (Google'ı beklerken):** Supabase event tablosu → GA4 → sitemap + robots/llms.txt → social cards → DMARC
2. **Google'dan e-posta gelince:** CASA süreci (paralelde Paddle sandbox)
3. **CASA + Paddle bitince:** Privacy/Terms güncelle → DB temizle → landing son hali → billing aç
4. **Lansman sonrası:** Ads, blog, free tools, Product Hunt
