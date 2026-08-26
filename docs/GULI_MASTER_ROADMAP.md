# GULI PREMIUM — MASTER ROADMAP

> Maqsad: loyihani kichik biznes uchun imkon qadar $0 bilan to‘liq ishga tushirish, barcha funksiyalarni barqaror holatga keltirish va keyin real trafik asosida bosqichma-bosqich kengaytirish.
>
> **QOIDA:** ishlab chiqish tugamaguncha pullik tarifga o‘tilmaydi. Destructive DB amallari qilinmaydi. Har bir production o‘zgarishi avval test qilinadi.

## 0. Maqsadli arxitektura

```text
GitHub (source of truth)
        |
        +--> Cloudflare Pages / Static Site (Telegram Web App frontend)
        |
        +--> Render Free Web Service (API + Telegram bot)
                         |
                         +--> Supabase Free (Postgres + Auth)
                         |
                         +--> Cloudflare R2 (product images + receipts + Telegram profile images)
                         |
                         +--> Telegram Bot / Channel / Group
```

### Boshlang‘ich sig‘im maqsadi
- ~1000 mahsulot.
- ~1000 ta to‘lov cheki.
- ~1000 ta Telegram profil rasmi.
- Mahsulot rasmlari uchun optimallashtirilgan storage.
- Pullik tarif faqat real trafik/resurs ehtiyoji isbotlangandan keyin.

### Vercel migratsiyasi
- [ ] Cloudflare Pages frontendni GitHub `main`ga ulash.
- [ ] Yangi frontend URL'da barcha smoke-testlarni bajarish.
- [ ] Telegram Bot Mini App URL'ini yangi frontend URL'ga almashtirish.
- [ ] Product deep-linkni yangi URL'da tekshirish.
- [ ] Auth redirect URL'larini yangi URL'ga moslash.
- [ ] Hammasi barqaror bo‘lgach Vercelni productiondan chiqarish.
- [ ] Vercelni o‘chirishdan oldin rollback uchun oxirgi READY deploymentni qayd etish.

---

# 1. DESIGN / UX

## 1.1 Bosh sahifa
- [x] Premium mobil vizual qatlam.
- [x] Hero/banner ko‘rinishi.
- [x] Kategoriya kartalari.
- [x] Pinyuar / Pijama / Byustgalter / Trusik / Mayku kategoriyalari.
- [x] Premium bottom navigation.
- [x] Safe-area/mobile ekran mosligi.
- [x] Product card shadow/spacing/typography.
- [x] Loading skeleton/shimmer.
- [ ] Real qurilmalarda 320/360/390/412 px test.
- [ ] iOS Telegram WebView test.
- [ ] Android Telegram WebView test.

## 1.2 Katalog
- [ ] Search UX.
- [ ] Filter/sort UX.
- [ ] Empty state.
- [ ] Loading state.
- [ ] Error state.
- [ ] 1000 mahsulot katalogida pagination/infinite-scroll samaradorligi.

## 1.3 Mahsulot detail
- [x] Premium detail styling.
- [x] Multiple image gallery runtime.
- [x] Swipe/thumbnail/arrow navigation.
- [ ] Image compression/optimized delivery.
- [ ] Size/color selector polish.
- [ ] Stock state polish.
- [ ] Add-to-cart microinteraction.
- [ ] Related products.
- [ ] Review summary.

## 1.4 Buyurtmalar
- [x] Order detail modal/drawer uchun visual qatlam.
- [ ] Status timeline.
- [ ] Mahsulotlar.
- [ ] Lokatsiya/manzil.
- [ ] To‘lov holati.
- [ ] Receipt preview.
- [ ] Responsive order details.

## 1.5 Checkout
- [ ] Cash/card/manual card UI final polish.
- [ ] 10-minute countdown.
- [ ] Expired state.
- [ ] Receipt upload state.
- [ ] Waiting-for-verification state.
- [ ] Verified/rejected state.
- [ ] Duplicate click/loading protection.

## 1.6 Review UI
- [ ] Review form.
- [ ] Rating stars.
- [ ] Optional photo upload.
- [ ] Customer review list.
- [ ] Verified purchase badge.
- [ ] Empty/loading/error states.

---

# 2. TELEGRAM BOT + MINI APP

## 2.1 Bot asoslari
- [ ] Bot webhook live endpointni tekshirish.
- [ ] `/start`.
- [ ] Menu button.
- [ ] Mini App URL.
- [ ] `/start` deep-link handling.
- [ ] Error/fallback messages.

## 2.2 Telegram auth
- [x] Server-side Telegram initData verification runtime.
- [ ] `X-Telegram-Init-Data` barcha kerakli frontend API requestlarda mavjudligini test qilish.
- [ ] Expired/invalid initData test.
- [ ] Guest fallback test.
- [ ] Telegram user profile sync.

## 2.3 Channel / Group product publishing
- [x] Backend publisher runtime.
- [x] Product photo publication.
- [x] `✨ Online market` button.
- [x] `🛍️ Sotib olish` button.
- [x] Product-code deep-link.
- [ ] Render `TELEGRAM_PRODUCT_CHAT_IDS` konfiguratsiyasi.
- [ ] Botni kanalga admin qilish.
- [ ] Botni guruhga kerakli huquqlar bilan qo‘shish.
- [ ] Test product publish.
- [ ] Multi-channel/group publish test.
- [ ] Failed Telegram send retry/logging.
- [ ] Optional user broadcast privacy/rate-limit review.

## 2.4 Product deep-link
- [x] `?product=<product_code>` runtime.
- [ ] Exact product lookup test.
- [ ] Product unavailable test.
- [ ] Deep-link from channel.
- [ ] Deep-link from group.
- [ ] Deep-link from bot chat.
- [ ] Deep-link after frontend hosting migration.

---

# 3. CATALOG / PRODUCT MANAGEMENT

## 3.1 Admin
- [ ] Add product.
- [ ] Edit product.
- [ ] Delete/archive product safely.
- [ ] Activate/deactivate.
- [ ] Product code uniqueness.
- [ ] Price/discount validation.
- [ ] Stock validation.
- [ ] Size/color management.
- [ ] Product image upload/optimization.

## 3.2 Catalog API
- [ ] Pagination.
- [ ] Stable product IDs/product_code compatibility.
- [ ] UUID/bigint compatibility.
- [ ] Cache headers where safe.
- [ ] Avoid loading all 1000 products unnecessarily.
- [ ] API error normalization.

---

# 4. CART / CHECKOUT / ORDER

## 4.1 Cart
- [ ] Add/remove/update quantity.
- [ ] Size/color preservation.
- [ ] Price snapshot.
- [ ] Stock check.
- [ ] Duplicate cart item handling.
- [ ] Cart persistence.

## 4.2 Order creation
- [ ] `create_secure_order` RPC production verification.
- [ ] UUID/bigint product ID compatibility.
- [ ] Duplicate-order protection.
- [ ] Server-side price calculation.
- [ ] Server-side stock validation.
- [ ] Address snapshot.
- [ ] Payment method snapshot.
- [ ] Order total integrity.

## 4.3 Delivery
- [ ] Saved address.
- [ ] Region/district/street/house/apartment/landmark.
- [ ] Location permissions.
- [ ] Manual address fallback.
- [ ] Delivery fee rules.

---

# 5. MANUAL CARD PAYMENT

## 5.1 Customer
- [ ] Select card.
- [ ] Open payment window immediately after order creation.
- [ ] Show card number/name.
- [ ] Show exact amount.
- [ ] 10-minute countdown.
- [ ] Upload receipt before expiry.
- [ ] `To‘lov qildim` button.
- [ ] Prevent receipt upload after expiry.
- [ ] Expired order status.
- [ ] Re-upload after rejected receipt where permitted.

## 5.2 Backend
- [x] Receipt upload deadline guard runtime.
- [ ] Verify payment window server-side using order creation timestamp.
- [ ] Receipt storage in R2.
- [ ] Receipt metadata in Supabase.
- [ ] Payment status state machine:
  - `pending`
  - `receipt_uploaded`
  - `verification_pending`
  - `verified`
  - `rejected`
  - `expired`

## 5.3 Admin
- [ ] Receipt appears in Orders list.
- [ ] Receipt appears in customer profile above status.
- [ ] Full-size receipt viewer.
- [ ] Approve.
- [ ] Reject with reason.
- [ ] Status sync to customer.
- [ ] Telegram notification.
- [ ] Audit timestamp.

---

# 6. CASH PAYMENT

- [ ] Cash checkout.
- [ ] Correct order status.
- [ ] Admin status transition.
- [ ] Telegram notification.
- [ ] Customer order detail.
- [ ] Delivery/completion flow.

---

# 7. RECEIPTS / FILE STORAGE

## Target
Use Cloudflare R2 for binary files when migration is complete:
- product images;
- payment receipts;
- review photos;
- Telegram profile images.

## Rules
- [ ] Max upload size.
- [ ] JPEG/PNG/WebP/PDF validation.
- [ ] Image resizing/compression.
- [ ] Unique object paths.
- [ ] No public exposure of private payment receipts.
- [ ] Signed/private receipt access for admin/customer.
- [ ] Cache product images.
- [ ] Do not store duplicate Telegram profile images.
- [ ] Cleanup policy for abandoned/expired uploads.

---

# 8. ADMIN PANEL

- [ ] Dashboard.
- [ ] Product management.
- [ ] Orders.
- [ ] Customer profiles.
- [ ] Receipt viewer.
- [ ] Payment approval/rejection.
- [ ] Order status transitions.
- [ ] Telegram notification state.
- [ ] Review moderation.
- [ ] Customer auth/profile information.
- [ ] Responsive admin UI.
- [ ] No secret values exposed in browser.

---

# 9. REVIEWS

- [x] Standalone review runtime added.
- [ ] Production `product_reviews` schema verification.
- [ ] Verified purchase rule.
- [ ] One review per customer/order/product.
- [ ] Photo upload to R2.
- [ ] Rating aggregation.
- [ ] Admin moderation.
- [ ] Hide/delete policy.
- [ ] Customer display.

---

# 10. AUTHENTICATION

## Customer
- [ ] Telegram auth.
- [ ] Email/password registration.
- [ ] Email/password login.
- [ ] OTP verification.
- [ ] Password reset.
- [ ] Session persistence.
- [ ] Logout.
- [ ] Rate limiting.
- [ ] Correct redirect after hosting migration.

## Admin
- [ ] Strong credentials.
- [ ] Admin token expiry.
- [ ] No credentials in GitHub.
- [ ] Receipt/review/order endpoint authorization.

---

# 11. DATABASE / SUPABASE

## Current principle
- Never delete/recreate production tables just to fix schema.
- Prefer idempotent `ALTER`, `CREATE IF NOT EXISTS`, indexes and safe RPC updates.
- Production SQL must be run manually when external DB permission is required.

## Verification queue
- [ ] `orders` schema.
- [ ] `saved_addresses`.
- [ ] `products` ID type.
- [ ] `create_secure_order` RPC.
- [ ] payment columns/status.
- [ ] receipt metadata.
- [ ] `product_reviews`.
- [ ] Storage buckets.
- [ ] RLS.
- [ ] Auth policies.
- [ ] Telegram user/profile data.

## Required user action when needed
If live Supabase execution cannot be performed by the assistant, give the user **one exact SQL file/action**, not multiple conflicting SQL instructions.

---

# 12. TELEGRAM NOTIFICATIONS

- [ ] New order notification.
- [ ] Payment receipt uploaded.
- [ ] Payment verification pending.
- [ ] Payment verified.
- [ ] Payment rejected.
- [ ] Order accepted.
- [ ] Preparing.
- [ ] Shipped/delivery.
- [ ] Delivered.
- [ ] Cancelled/expired.
- [ ] Avoid duplicate notifications.
- [ ] Handle Telegram API failures without breaking order state.

---

# 13. PERFORMANCE

## Frontend
- [ ] CDN hosting.
- [ ] Lazy images.
- [ ] WebP/AVIF where supported.
- [ ] Product pagination.
- [ ] Avoid unnecessary API polling.
- [ ] Debounced search.
- [ ] Skeleton loading.
- [ ] Bundle size check.

## Backend
- [ ] Render sleep behavior documented for Free stage.
- [ ] Fast health endpoint.
- [ ] Avoid blocking startup.
- [ ] Telegram API calls asynchronous.
- [ ] Timeouts/retries.
- [ ] Rate limiting.

## Database
- [ ] Product indexes.
- [ ] Order indexes.
- [ ] Review indexes.
- [ ] Avoid `select *` for large lists.
- [ ] Pagination everywhere.

---

# 14. SECURITY

- [ ] Telegram initData HMAC verification server-side.
- [ ] Admin authorization server-side.
- [ ] No secrets in frontend/GitHub.
- [ ] Receipt files private.
- [ ] Server-side price/stock validation.
- [ ] Upload MIME/type/size validation.
- [ ] Rate limiting.
- [ ] CORS restricted appropriately.
- [ ] SQL/RPC authorization.
- [ ] No destructive migrations.
- [ ] Error messages do not expose secrets/database details.

---

# 15. TESTING / CI

For every meaningful change:
- [ ] GitHub Actions passes.
- [ ] Frontend build passes.
- [ ] Backend syntax passes.
- [ ] Runtime JS syntax passes.
- [ ] API smoke tests.
- [ ] Telegram auth smoke test.
- [ ] Catalog smoke test.
- [ ] Checkout smoke test.
- [ ] Manual card flow test.
- [ ] Receipt upload test.
- [ ] Admin approval test.
- [ ] Auth/OTP test.
- [ ] Responsive test.

Never report external deployment/database/bot changes as successful without independent verification.

---

# 16. PRODUCTION MIGRATION ORDER

### Phase A — Freeze current production
1. [ ] Record last known-good production deployment.
2. [ ] Keep Vercel as temporary rollback only.
3. [ ] Do not delete Vercel yet.

### Phase B — New free frontend
4. [ ] Create Cloudflare Pages project from GitHub.
5. [ ] Build/deploy `main`.
6. [ ] Verify HTTPS and Telegram Web App.
7. [ ] Verify deep links.

### Phase C — Backend
8. [ ] Keep Render API/Bot.
9. [ ] Set required environment variables.
10. [ ] Verify health endpoint.
11. [ ] Verify Telegram webhook.
12. [ ] Verify channel/group permissions.

### Phase D — Full functional QA
13. [ ] Catalog.
14. [ ] Product detail.
15. [ ] Cart.
16. [ ] Cash checkout.
17. [ ] Card checkout.
18. [ ] Receipt.
19. [ ] Admin verification.
20. [ ] Telegram notifications.
21. [ ] Orders.
22. [ ] Auth/OTP.
23. [ ] Reviews.
24. [ ] Responsive UI.

### Phase E — Storage
25. [ ] Create R2 buckets/paths.
26. [ ] Migrate product images safely.
27. [ ] Migrate receipt storage safely.
28. [ ] Migrate review/profile images.
29. [ ] Verify URLs/access.
30. [ ] Only then switch new uploads to R2.

### Phase F — Switch Telegram
31. [ ] Update bot Menu Button URL.
32. [ ] Update Mini App URL.
33. [ ] Test `/start`.
34. [ ] Test product deep-link.
35. [ ] Test channel/group product post.

### Phase G — Retire Vercel
36. [ ] Confirm Cloudflare frontend stable.
37. [ ] Confirm Telegram uses new URL.
38. [ ] Confirm backend uses new CORS/redirect URL.
39. [ ] Keep rollback reference.
40. [ ] Remove Vercel only after all tests pass.

---

# 17. SCALING PLAN

## Stage 1 — $0 / development + initial business
Target: ~1000 products, ~1000 receipts, ~1000 Telegram profile images.
- Cloudflare Pages Free.
- Render Free.
- Supabase Free.
- Cloudflare R2 Free.
- Monitor storage, bandwidth, API latency and Render sleep.

## Stage 2 — Growing customer traffic
Upgrade only the resource that becomes a real bottleneck:
- Render paid instance if API sleep/CPU becomes a problem.
- Supabase paid tier if DB/storage/auth/egress limits become a problem.
- R2 paid storage if object storage exceeds Free allocation.
- CDN/cache remains in place.

## Stage 3 — Large marketplace
- Separate backend workers.
- Queue for Telegram broadcasts.
- Image processing pipeline.
- Database read replicas/index review where needed.
- Observability/alerts.
- Backups and disaster recovery.
- Rate limiting/WAF.
- Dedicated storage policies.

**Do not upgrade by guesswork. Upgrade from measured bottlenecks.**

---

# 18. CURRENT NEXT ACTIONS

1. Finish current design work without touching payment/business logic.
2. Complete Telegram channel/group publishing configuration.
3. Complete product deep-link QA.
4. Finish card receipt/admin verification UX.
5. Finish `Mening buyurtmalarim` detail view.
6. Finish review UI and production schema verification.
7. Finish customer auth/OTP QA.
8. Prepare Cloudflare Pages migration.
9. Prepare R2 storage migration.
10. Run complete end-to-end smoke test.
11. Only after all green: switch Telegram to new frontend URL.
12. Only after stable production: remove Vercel.

---

## CHANGE LOG / DECISION LOG

- **2026-08-26:** Decision: do not pay for hosting/tariffs before the initial business is fully tested and launched.
- **2026-08-26:** Preferred target architecture: GitHub + Cloudflare Pages + Render Free + Supabase Free + Cloudflare R2 + Telegram.
- **2026-08-26:** Initial capacity target: ~1000 products, ~1000 payment receipts, ~1000 Telegram profile images.
- **2026-08-26:** Vercel is temporary until Cloudflare Pages migration is proven; do not delete it prematurely.
- **2026-08-26:** No destructive DB operations.
- **2026-08-26:** External changes must be independently verified; never claim success without evidence.
