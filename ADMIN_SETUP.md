# GULI Premium Admin

## Included

- `/admin` protected login page
- Dashboard: today's revenue, orders, customers, products, status counts and low-stock alerts
- Product CRUD: create, edit, price, old price, stock, images, sizes, colors, featured and active state
- Order management: full order list and status changes
- Customer list: Telegram identity and phone data
- Promo code CRUD: percent/fixed discount, minimum order, usage limit and active state
- Responsive desktop/tablet/mobile admin UI
- HMAC-signed 8-hour admin sessions
- Telegram Mini App `initData` validation for customer order/address/identity APIs
- Server-side promo validation endpoint

## Backend environment

Set these on the Render backend service, not in Vercel:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SECRET` — **required**, long random secret used to sign admin sessions. It is intentionally not allowed to fall back to the admin password.
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `TELEGRAM_BOT_TOKEN`

Never commit any of these values to GitHub.

## Admin URL

After Vercel deploys, open:

`https://<your-production-domain>/admin`

## Automated validation

`.github/workflows/ci.yml` validates the frontend build and runs `node --check backend/index.js` on every push/PR to `main`.

## Current engineering priorities

1. Connect the storefront promo button to `/api/promo/validate` so admin-managed codes are used instead of the temporary local 10% behavior.
2. Add a transactional promo usage increment (prefer a Supabase RPC) so usage limits remain correct under concurrent checkouts.
3. Add admin audit log and role separation when a second administrator is needed.
4. Add staging Supabase integration tests for orders, promo validation and admin CRUD.
5. Add Telegram order-status notifications and delivery messaging.
