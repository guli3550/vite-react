# GULI Premium Admin

## What is included

- `/admin` protected login page
- Dashboard: today revenue, orders, customers, products, status counts and low-stock alerts
- Product CRUD: create, edit, price, old price, stock, images, sizes, colors, featured and active state
- Order management: full order list and status changes
- Customer list: Telegram identity and phone data
- Promo code CRUD: percent/fixed discount, minimum order, usage limit and active state
- Responsive desktop/tablet/mobile admin UI
- HMAC-signed 8-hour admin sessions; credentials are never shipped to the browser

## Backend environment

Set these on the Render backend service, not in Vercel:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SECRET` — long random secret used to sign admin sessions

The existing `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `TELEGRAM_BOT_TOKEN` remain backend-only.

## Admin URL

After Vercel deploys, open:

`https://<your-production-domain>/admin`

## Automated validation

`.github/workflows/ci.yml` now validates the frontend build and runs `node --check backend/index.js` on every push/PR to `main`.

## Next engineering priorities

1. Validate Telegram Mini App `initData` server-side before accepting customer identity/order mutations.
2. Connect storefront promo-code validation to the admin-managed `promo_codes` table.
3. Add admin audit log and role separation when a second administrator is needed.
4. Add automated API integration tests against a staging Supabase project.
5. Add order notification templates for Telegram status changes.
