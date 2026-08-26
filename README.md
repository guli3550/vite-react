# GULI PREMIUM — Telegram Mini App / Online Market

Production storefront for GULI PREMIUM. The repository is the source of truth for the Render storefront, Render API, Cloudflare gateway, Telegram bot integration and Supabase commerce data model.

## Production architecture

`Telegram Mini App / Render Static Site → Cloudflare Worker → Render Node API → Supabase`

- **Frontend:** Vite + React + TypeScript
- **Storefront:** Render Static Site `guli-lingerie-web`
- **Backend:** Render Web Service `guli-lingerie-api`
- **Gateway:** Cloudflare Worker `guli-gateway`
- **Database/storage/auth:** Supabase
- **Bot:** Telegram Bot API + Mini App `initData`
- **Payments:** cash + manual HUMO/UZCARD receipt workflow
- **Admin:** `/admin`, HMAC-signed sessions, product/order/customer/promo/category management

## Storefront design

The mobile UI uses the GULI premium pastel-pink reference design:

- five categories: **Pinyuar, Pijama, Byusgalter, Mayka, Tursik**
- category covers are loaded from Supabase `category_settings`
- admins can replace category images from `/admin`
- rounded product cards, discount badges and floating bottom navigation

## Development

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Backend:

```bash
cd backend
npm install
npm start
```

## Environment

Frontend production API is the Cloudflare gateway. Backend secrets belong on Render only.

See `.env.example` and `ADMIN_SETUP.md`.

## Database migrations

Production SQL files are under `supabase/`. In particular, `repair_existing_schema.sql` repairs legacy commerce schemas and `checkout_runtime_repair.sql` installs the UUID/bigint-safe secure checkout RPC.

## Deployment rule

The production storefront is deployed on **Render**. Vercel is not used for the storefront deployment.

GitHub Actions provides build/syntax validation and scheduled production smoke checks for Render, Cloudflare, catalog, category settings and customer auth guards.
