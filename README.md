# GULI PREMIUM — Telegram Mini App / Online Market

Production storefront for GULI PREMIUM.

## Canonical production architecture

`Telegram Mini App / Browser → Vercel storefront → Render API → Supabase`

- **Canonical frontend:** Vercel `vite-react-seven-inky-10.vercel.app`
- **Storefront:** `/`
- **Admin:** `/admin`
- **Backend/API:** Render Web Service `guli-lingerie-api`
- **Database/storage/auth:** Supabase
- **Realtime:** Supabase Realtime → backend SSE bridge for chat events
- **Bot:** Telegram Bot API + Mini App `initData`
- **Payments:** cash + manual HUMO/UZCARD receipt workflow

Vercel is the single frontend URL for Telegram Mini App and normal browser users. Render is backend-only and must not be used as the public storefront URL.

## Unified chat architecture

Telegram users, browser users and admins use the same backend chat service and the same `chat_messages` database table. Browser `localStorage`/`BroadcastChannel` are UI cache/synchronization helpers only; persistent chat data belongs to the backend database.

The backend maintains one Supabase Realtime subscription and exposes authenticated SSE streams to clients. This avoids per-client polling loops and keeps server load lower while allowing new messages to reach the relevant customer and all admin sessions.

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

Frontend API:

```text
VITE_API_URL=https://guli-lingerie-api.onrender.com
```

Backend secrets belong on Render only. The backend uses `VERCEL_APP_URL` / `MINI_APP_URL` when generating Telegram Mini App and product links.

Required Telegram notification configuration includes `TELEGRAM_ADMIN_CHAT_IDS` for admin chat alerts.

See `.env.example` and `ADMIN_SETUP.md`.

## Database

Production SQL files are under `supabase/`. The existing `chat_messages.sql` creates the persistent chat table. Any additional chat security/realtime hardening SQL must be applied explicitly in Supabase before relying on those optional database-side changes.

## Deployment rule

The production storefront is deployed on **Vercel**. The canonical URL is:

`https://vite-react-seven-inky-10.vercel.app`

Use:

`https://vite-react-seven-inky-10.vercel.app/admin`

for the admin panel.

Telegram product broadcasts and Mini App buttons must use the Vercel URL. Render is backend-only.

GitHub Actions provides build/syntax validation and scheduled production smoke checks.