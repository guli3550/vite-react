# GULI PRODUCTION AUDIT v1.1 — Customer Identity / Orders / Receipts

Date: 2026-09-12
Branch: `main`
Canonical frontend: `https://vite-react-seven-inky-10.vercel.app`
Backend: `https://guli-lingerie-api.onrender.com`
Database/Auth: Supabase project `qttwufydrvdwmhxcpgjb`

## User-reported production findings

1. Browser card receipt uploads, but the customer's Orders screen did not show the order; admin order/receipt could see it.
2. Telegram Mini App receipt uploads were not visible in the admin payment view while the order existed.
3. Browser profile photo was rendered against the wrong/all CRM customers.
4. Telegram profile photo was rendered against the wrong/all CRM customers.
5. Browser and Telegram identities were split into separate customer profiles instead of one canonical person.
6. After logout, private customer data must be hidden; authenticated personal account should appear only in the profile card. Account switching UI is not required.
7. Logout must not be offered to an unregistered/guest visitor.

## Changes completed in this audit

- Production `customers` table created with `auth_user_id`, `telegram_id`, email, phone, provider and `avatar_url`.
- `orders.auth_user_id` added with index and customer-scoped RLS/grants.
- Unique/indexed customer identity keys added for Telegram ID, normalized email lookup and phone lookup.
- Authenticated browser card checkout uses Supabase access token and binds the order to `auth_user_id`.
- Authenticated receipt upload stores the receipt in private `payment-receipts` storage and binds it to the authenticated order owner.
- Unified customer bridge added so browser Supabase users and verified Telegram Mini App users use the same `customers` identity model.
- Telegram customer sync stores the Telegram `photo_url` on that customer's own CRM row instead of using a shared/local avatar fallback.
- Browser profile updates persist the avatar/name/phone to the canonical customer row.
- Customer order history route accepts authenticated Supabase identity as well as verified Telegram identity and scopes results to that identity.
- Telegram/browser card receipt route is unified and owner-scoped.
- Admin private receipt preview resolves through the protected signed-URL endpoint.
- Frontend source transform removes the `Hisobni almashtirish` action and changes the profile CTA to registration for unauthenticated visitors.
- Frontend order-history guard permits authenticated browser users instead of requiring a Telegram ID.
- Production smoke workflow was corrected to test the authenticated order route with POST; previous GET failure was a test defect.

## Important identity rule

The canonical customer is the `customers` row. A person may have:

- `auth_user_id` for browser Email/Google authentication;
- `telegram_id` for Telegram Mini App authentication;
- both values when the identities have been explicitly/strongly linked;
- one canonical `avatar_url` owned by that customer row.

Automatic cross-channel linking is allowed only when there is a strong matching identifier available (currently authenticated user + verified phone/Telegram customer record). Do not blindly merge customers by display name or username.

## Logout/privacy acceptance criteria

- Logged-out browser: no private profile card, customer order history, private receipt data, or authenticated checkout.
- Logged-out UI: registration CTA only; no account-switching CTA.
- Registered/authenticated user: profile card and own private data only.
- Telegram Mini App: verified Telegram identity and its own CRM row/order history only.

## Verification status

### Automated

- Vercel storefront health: PASS
- Render API health: PASS
- Cloudflare gateway health: PASS
- Catalog API: PASS
- Category API: PASS
- Unauthenticated customer protection: PASS
- Authenticated card route smoke test: fixed to use POST; must remain green after each Render deploy.

### Manual production tests still required

1. Browser Email/Google login -> change profile photo -> verify only that CRM customer changes.
2. Browser checkout -> order appears immediately in `Buyurtmalarim` and admin.
3. Browser receipt -> admin Payments shows the receipt preview and payment status.
4. Telegram Mini App -> change photo -> verify only Telegram customer changes in CRM.
5. Telegram checkout + receipt -> admin Payments shows receipt and order owner.
6. Link browser/Telegram identity using a strong shared identifier and verify one customer row rather than two.
7. Logout -> refresh/reopen profile -> private customer data is hidden and only registration CTA remains.
8. Verify no account-switching action is visible to an authenticated user.

## Do not merge

Do not merge the old unrelated PR #1. Current audit fixes are committed directly to `main`.

## Continuation protocol

When continuing this audit, first read this document and the existing payment-security audit. Then verify current `main`, production smoke, Render deployment state, and Supabase schema before making new changes. Preserve Telegram order/payment functionality and never weaken authentication to make a UI test pass.
