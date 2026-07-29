# Launch checklist (deferred items — do before public launch)

Bu dosya "zamanı gelince yapılacaklar" listesidir. Bir madde bittiğinde işaretle.

## 1. Google OAuth doğrulaması + CASA denetimi (EN KRİTİK, zorunlu)
- [ ] Google Cloud Console → OAuth consent screen → doğrulama başvurusu (`gmail.modify` restricted scope).
- [ ] CASA Tier 2 güvenlik denetimi (yıllık, Google'ın anlaşmalı denetçileri üzerinden; TAC Security vb.).
- [ ] Gerekenler: canlı domain (inboxwingman.com), privacy policy URL'i, demo video, scope gerekçeleri.
- [ ] Consent screen markalama (Fyxer örneğindeki gibi görünmesi için): 120x120 logo yükle, app adı "Inbox Wingman", support e-postası, authorized domain inboxwingman.com, Privacy (/privacy) ve Terms (/terms) URL'leri.
- Not: `gmail.modify` consent ekranında "okuma, oluşturma ve gönderme" yazar (Fyxer'da da aynı). Wingman göndermediği için bu mesajı site + onboarding'de dengelemeye devam et.
- [ ] Geçince siteye "Google-verified · CASA audited" rozeti ekle (landing CTA güven şeridi + /security sayfası).
- Not: Doğrulama olmadan testing modunda max 100 test kullanıcısı; herkese açık girişte "unverified app" uyarısı çıkar.

## 2. Şirket kimliği (impressum)
- [ ] Şirket kurulunca tüzel kişilik adı + adres:
  - [ ] Terms of Service'e ("The service" bölümüne taraf olarak),
  - [ ] Privacy Policy'ye (data controller kimliği olarak),
  - [ ] Site footer'ına (kısa satır),
  - [ ] DPA sayfasına (processor kimliği).

## 3. Ucuz ama etkili güven işleri
- [ ] Veritabanını EU bölgesine taşı/kur (Supabase/Railway bölge seçimi) → sonra sitede "data stored in the EU" yaz (privacy + security + subprocessors Region kolonları güncellenecek).
- [ ] `public/.well-known/security.txt` ekle (Contact: support@inboxwingman.com, Policy: /security).
- [ ] /security sayfasına responsible disclosure satırı zaten var — security.txt ile linkle.

## 4. Paddle migrasyonu (billing kodu hâlâ Stripe)
- [ ] Paddle hesabı + sandbox API key + ürün/fiyatlar (Pilot $13, Wingman $39, top-up paketleri — kod `PLANS`/`sellPriceCents` formülünden alır, oradaki güncel değerleri kullan).
- [ ] Checkout + webhook + portal kodunu Stripe'tan Paddle Billing'e geçir (`src/lib/billing.ts`, `src/app/api/stripe/*`, `deleteAccount` içindeki abonelik iptali).
- Not: Legal sayfalar (terms, subprocessors, privacy) şimdiden Paddle yazıyor — kod geçene kadar canlıya alma.

## 5. Daha önceki manuel operasyon notları
- [ ] Google OAuth redirect URI'larına `{APP_URL}/api/gmail/link/callback` ekle.
- [ ] Domain (inboxwingman.com) → Railway custom domain; `AUTH_URL` / `APP_URL` / OAuth redirect'leri güncelle.
