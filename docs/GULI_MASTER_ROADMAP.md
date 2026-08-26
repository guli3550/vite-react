# GULI PREMIUM — MASTER ROADMAP

> Maqsad: loyihani kichik biznes uchun imkon qadar $0 bilan to‘liq ishga tushirish, barcha funksiyalarni barqaror holatga keltirish va keyin real trafik asosida bosqichma-bosqich kengaytirish.
>
> **QOIDA:** ishlab chiqish tugamaguncha pullik tarifga o‘tilmaydi. Destructive DB amallari qilinmaydi. Har bir production o‘zgarishi avval test qilinadi.

## 0. Maqsadli arxitektura

```text
GitHub (source of truth)
        |
        +--> Cloudflare Pages (Web App / CDN)
        |
        +--> Cloudflare Worker (fast API gateway + Telegram webhook)
        |             |
        |             +--> catalog cache
        |             +--> health endpoint
        |             +--> Telegram webhook (no Render cold start)
        |             +--> proxy during migration
        |
        +--> Render Free Web Service (temporary API/business logic during migration)
        |             |
        |             +--> Supabase Free (Postgres + Auth)
        |             +--> Telegram API
        |
        +--> Cloudflare R2 (product images + receipts + Telegram profile images)
```

### Performance target
- Web App static assets: CDN, no application-server cold start.
- Catalog: edge cache; do not fetch the same 1000-product list from Supabase for every user.
- Product detail: short edge cache with stale-while-revalidate.
- Telegram webhook: move to Cloudflare Worker so `/start` and basic bot response do not wait for Render wake-up.
- Orders: keep server-side validation and `create_secure_order`; migrate only after endpoint-by-endpoint verification.
- No paid tier before the initial business is fully tested and launched.

### Initial capacity target
- ~1000 products.
- ~1000 payment receipts.
- ~1000 Telegram profile images.
- Optimized product images.

### Vercel migration
- [ ] Cloudflare Pages frontend connected to GitHub `main`.
- [ ] New frontend URL fully smoke-tested.
- [ ] Telegram Mini App URL switched to new frontend.
- [ ] Product deep-links verified.
- [ ] Auth redirects verified.
- [ ] Only then remove Vercel.

### Cloudflare gateway migration — NEW
- [x] Worker gateway source created in `cloudflare-worker/index.js`.
- [x] `wrangler.toml` added.
- [x] `/api/products` edge cache added.
- [x] `/api/products/:id` edge cache added.
- [x] `/api/health` fast gateway health endpoint added.
- [x] Telegram `/start` and `/shop` direct Worker response added.
- [x] Remaining endpoints proxy to Render during migration.
- [ ] Deploy Worker to Cloudflare.
- [ ] Set `TELEGRAM_BOT_TOKEN` as Cloudflare secret.
- [ ] Set Telegram webhook to Worker URL.
- [ ] Point frontend `VITE_API_URL` to Worker URL.
- [ ] Verify catalog latency and cache hit rate.
- [ ] Migrate order/auth/payment endpoints only after tests.
- [ ] Remove Render only after full endpoint migration and rollback test.

---

# 1. DESIGN / UX

## 1.1 Bosh sahifa
- [x] Premium mobil visual layer.
- [x] Hero/banner.
- [x] Category cards.
- [x] Pinyuar / Pijama / Byustgalter / Trusik / Mayku.
- [x] Premium bottom navigation.
- [x] Safe-area/mobile compatibility.
- [x] Product card shadows/spacing/typography.
- [x] Loading skeleton/shimmer.
- [ ] Real-device 320/360/390/412 px tests.
- [ ] iOS Telegram WebView test.
- [ ] Android Telegram WebView test.

## 1.2 Katalog
- [ ] Search UX.
- [ ] Filter/sort UX.
- [ ] Empty/loading/error states.
- [ ] Pagination/infinite scroll for 1000 products.
- [ ] Verify edge cache freshness after admin product changes.

## 1.3 Mahsulot detail
- [x] Premium styling.
- [x] Multiple image gallery.
- [x] Swipe/thumbnail/arrow navigation.
- [ ] Image compression/optimized delivery.
- [ ] Size/color selector polish.
- [ ] Stock state polish.
- [ ] Add-to-cart microinteraction.
- [ ] Related products.
- [ ] Review summary.

## 1.4 Buyurtmalar
- [x] Order detail visual layer.
- [ ] Status timeline.
- [ ] Products/address/payment/receipt details.
- [ ] Responsive order details.

## 1.5 Checkout
- [ ] Cash/card/manual card final UI.
- [ ] 10-minute countdown.
- [ ] Expired state.
- [ ] Receipt upload.
- [ ] Waiting/verified/rejected states.
- [ ] Duplicate-click protection.

## 1.6 Review UI
- [ ] Review form/rating/photos.
- [ ] Verified purchase badge.
- [ ] Customer list/empty/loading/error states.

---

# 2. TELEGRAM BOT + MINI APP

- [x] Telegram initData verification runtime.
- [x] Product publish runtime.
- [x] Product deep-link runtime.
- [ ] Worker webhook deployment.
- [ ] Channel/group permissions.
- [ ] Product publish real test.
- [ ] Bot menu URL on final frontend.
- [ ] `/start`, `/shop`, contact, order/payment notifications end-to-end.

---

# 3. CATALOG / PRODUCT MANAGEMENT

- [ ] Add/edit/archive/activate.
- [ ] Product code uniqueness.
- [ ] Price/discount/stock validation.
- [ ] Image optimization.
- [ ] Pagination and stable UUID/bigint compatibility.

---

# 4. CART / CHECKOUT / ORDER

- [ ] Cart quantity/variant/stock handling.
- [ ] `create_secure_order` production verification.
- [ ] Server-side price/stock validation.
- [ ] Duplicate-order protection.
- [ ] Address/payment snapshots.
- [ ] Delivery rules.

---

# 5. MANUAL CARD PAYMENT

- [ ] Card window.
- [ ] 10-minute countdown.
- [ ] Receipt before expiry.
- [ ] Payment status state machine.
- [ ] Admin receipt viewer/approve/reject.
- [ ] Customer status sync.
- [ ] Telegram notifications.

---

# 6. CASH PAYMENT

- [ ] Checkout/status/notification/order detail flow.

---

# 7. FILE STORAGE

Target Cloudflare R2:
- product images;
- payment receipts;
- review photos;
- Telegram profile images.

Rules:
- [ ] size/MIME validation;
- [ ] image resize/compression;
- [ ] unique object paths;
- [ ] private receipts + signed access;
- [ ] cache product images;
- [ ] duplicate profile-image avoidance;
- [ ] abandoned-upload cleanup.

---

# 8. ADMIN PANEL

- [ ] Dashboard.
- [ ] Products.
- [ ] Orders.
- [ ] Customer profiles.
- [ ] Receipt viewer.
- [ ] Payment verification.
- [ ] Status transitions.
- [ ] Telegram notification state.
- [ ] Review moderation.
- [ ] Responsive admin UI.
- [ ] No secrets in browser.

---

# 9. REVIEWS

- [x] Review runtime source.
- [ ] Production schema verification.
- [ ] Verified purchase rule.
- [ ] R2 photo upload.
- [ ] Rating aggregation.
- [ ] Admin moderation.

---

# 10. AUTHENTICATION

- [ ] Telegram auth.
- [ ] Email/password.
- [ ] OTP.
- [ ] Password reset.
- [ ] Session persistence/logout.
- [ ] Rate limiting.
- [ ] Final hosting redirect verification.

---

# 11. DATABASE / SUPABASE

- [ ] `orders` schema.
- [ ] `saved_addresses`.
- [ ] `products` ID type.
- [ ] `create_secure_order` RPC.
- [ ] payment/receipt metadata.
- [ ] `product_reviews`.
- [ ] Storage/RLS/Auth policies.
- [ ] Telegram user/profile data.

**Rule:** never delete/recreate production tables just to fix schema; use idempotent safe migrations.

---

# 12. TELEGRAM NOTIFICATIONS

- [ ] New order.
- [ ] Receipt uploaded.
- [ ] Verification pending/verified/rejected.
- [ ] Order status changes.
- [ ] No duplicate notifications.
- [ ] Telegram API failures must not corrupt order state.

---

# 13. PERFORMANCE

- [x] Cloudflare Worker gateway source.
- [x] Catalog edge cache source.
- [ ] Catalog cache invalidation/freshness test.
- [ ] WebP/AVIF image delivery.
- [ ] Lazy images.
- [ ] Search debounce.
- [ ] API request batching where safe.
- [ ] Render cold-start removal from customer-facing critical paths.
- [ ] Order endpoint latency test.
- [ ] Telegram webhook latency test.

---

# 14. SECURITY

- [ ] Telegram HMAC server-side.
- [ ] Admin server-side authorization.
- [ ] No secrets in GitHub/frontend.
- [ ] Private receipts.
- [ ] Price/stock validation.
- [ ] Upload validation.
- [ ] Rate limits.
- [ ] CORS restrictions.
- [ ] RPC authorization.

---

# 15. TESTING / CI

Every meaningful change:
- [ ] GitHub Actions.
- [ ] frontend build.
- [ ] backend syntax.
- [ ] Worker syntax/build.
- [ ] API smoke tests.
- [ ] Telegram auth.
- [ ] Catalog.
- [ ] Checkout.
- [ ] Payment/receipt.
- [ ] Admin.
- [ ] Auth/OTP.
- [ ] Responsive.

Never report an external deployment/database/bot change as successful without independent verification.

---

# 16. PRODUCTION MIGRATION ORDER

1. Keep current Vercel as rollback.
2. Deploy Cloudflare Pages.
3. Deploy Cloudflare Worker gateway.
4. Test health/catalog/detail.
5. Test Telegram webhook and bot menu.
6. Point frontend API to Worker.
7. Test auth/cart/order/payment.
8. Move file storage to R2 safely.
9. Full end-to-end QA.
10. Switch Telegram Mini App URL.
11. Keep Render as rollback until stable.
12. Remove Vercel only after stable Cloudflare production.
13. Remove Render only after all critical API endpoints are migrated and verified.

---

# 17. SCALING PLAN

## Stage 1 — $0 / development + initial business
Target: ~1000 products, ~1000 receipts, ~1000 Telegram profile images.
- Cloudflare Pages Free.
- Cloudflare Workers Free.
- Render Free only as temporary migration backend.
- Supabase Free.
- Cloudflare R2 Free when configured.

Cloudflare Workers Free currently allows 100,000 requests/day; Pages static asset requests are free/unlimited, with 500 Free builds/month and 20,000 files/site. These limits are monitored rather than assumed. citeturn0search1turn0search3turn0search0

## Stage 2 — Growing traffic
Upgrade only measured bottlenecks:
- Worker paid if daily request/CPU limits are reached.
- Supabase paid if DB/storage/auth/egress requires it.
- R2 paid if object storage exceeds Free allocation.

## Stage 3 — Large marketplace
- Queues/workers.
- Image processing pipeline.
- DB optimization/read scaling.
- Observability/alerts.
- Backups/disaster recovery.
- WAF/rate limiting.

**Do not upgrade by guesswork. Upgrade from measured bottlenecks.**

---

# CURRENT NEXT ACTIONS

1. Deploy `cloudflare-worker` to Cloudflare.
2. Add `TELEGRAM_BOT_TOKEN` as a Cloudflare secret.
3. Verify Worker `/api/health` and `/api/products`.
4. Set Telegram webhook to Worker URL.
5. Point frontend `VITE_API_URL` to Worker URL.
6. Verify catalog speed/cache.
7. Then migrate order/auth/payment endpoints one by one.
8. Only after all green, switch final Telegram Mini App URL and retire Vercel/Render.

## DECISION LOG

- 2026-08-26: No paid tariff before initial launch/testing.
- 2026-08-26: Target ~1000 products, ~1000 receipts, ~1000 Telegram profile images.
- 2026-08-26: Preferred architecture: GitHub + Cloudflare Pages + Cloudflare Worker + Supabase + R2 + Telegram.
- 2026-08-26: Vercel remains rollback until Cloudflare is proven.
- 2026-08-26: Render remains temporary backend during migration.
- 2026-08-26: No destructive DB operations.
- 2026-08-26: Never claim unverified external success.
