# GULI Premium Admin

## Included

- `/admin` protected login page
- Dashboard: today's revenue, orders, customers, products, status counts and low-stock alerts
- Product CRUD: create, edit, price, old price, stock, images, sizes, colors, featured and active state
- Category cover management: five storefront categories with admin image upload and replacement
- Order management: full order list and status changes
- Customer list: Telegram identity and phone data
- Promo code CRUD: percent/fixed discount, minimum order, usage limit and active state
- Responsive desktop/tablet/mobile admin UI
- HMAC-signed 8-hour admin sessions
- Telegram Mini App `initData` validation for customer order/address/identity APIs
- Server-side promo validation and transactional checkout validation

## Production environment

Store secrets only on the Render backend service, never in GitHub or the static frontend:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SECRET` — required, long random secret used to sign admin sessions
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `TELEGRAM_BOT_TOKEN`
- `CARD_PAYMENT_NUMBER`
- `CARD_PAYMENT_NAME`
- `MINI_APP_URL=https://guli-lingerie-web.onrender.com/`

The storefront is deployed on Render. Cloudflare Worker `guli-gateway` is the public API gateway in front of the Render backend.

## Admin URL

Open the `/admin` path on the current Render storefront domain.

## Database prerequisites

The following SQL migrations are stored in `supabase/` and must be applied to the production Supabase project as required:

1. `repair_existing_schema.sql` — legacy commerce/schema repair
2. `production_payment_reviews_repair.sql` — payment/review fields and runtime repair
3. `checkout_runtime_repair.sql` — canonical UUID/bigint-safe secure checkout RPC
4. `storefront_visual_upgrade.sql` — category settings and storefront image seed

`checkout_runtime_repair.sql` is especially important when the legacy `products.id` type is UUID.

## Automated validation

`.github/workflows/ci.yml` validates the frontend build and backend syntax. `.github/workflows/production-smoke.yml` checks the Render storefront, Render API, Cloudflare gateway, catalog, category settings, and unauthenticated customer endpoint guard.

## Production architecture

`Telegram Mini App / Render Web → Cloudflare Worker gateway → Render API → Supabase`

Telegram bot commands, menu configuration, order notifications and payment notifications use the same backend Telegram integration. The Render storefront is the production Mini App target; Vercel is not used for storefront deployment.
