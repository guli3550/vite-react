# GULI Production Audit v1.0 — Fix Sequence

## Architecture
Telegram Bot → Render API → Supabase
Telegram Mini App → Vercel → Render API

## Source of truth
- Products/orders/payments/chat/customer state: Supabase via authenticated API.
- localStorage is cache/UI-only, never authoritative production data.
- Vercel is the canonical Mini App frontend.
- Render is the canonical API/webhook backend until an explicitly approved gateway migration.

## P0 sequence
1. Payment timeout/reject stock + promo rollback.
2. Telegram webhook secret-token verification.
3. Canonical Mini App URL and removal of legacy/hardcoded URLs.
4. Production CORS allowlist.
5. Verify production `orders` RLS/policies before changing schema.
6. Canonical smoke-test target: Vercel Mini App + Render API + Telegram webhook.
7. Admin/customer source-of-truth alignment.
8. Banner persistence/API contract.
9. Order-status hardening: client cannot set privileged status.
10. Product identifier compatibility (`id` and `product_code`).
11. Chat media/reply/reaction persistence.

## P1/P2
- Customer 360 and server-side conversation metadata.
- Payment settings server-side.
- Remove demo payment fallbacks.
- Category canonical IDs/names.
- Telegram broadcast target policy and registry cleanup.
- Banner storage and UX improvements.

## Release gate
No production deployment is considered complete until build passes and smoke tests cover: product deep-link, catalog, cart, checkout, receipt upload, admin payment verification, order status, chat text/media/reply, Telegram broadcast, and banner update.
