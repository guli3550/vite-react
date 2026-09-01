# GULI PRODUCTION AUDIT v1.0 — Payment / Receipt / Admin Security

Date: 2026-09-01
Branch: `audit/payment-security-20260901`
PR: `#13`

## Audit architecture

`UI -> runtime bridges -> API -> auth -> business rules -> Supabase DB/Storage -> Telegram notifications -> deployment`

Every finding is classified by:
- impact;
- root cause;
- exact code path;
- security/control requirement;
- test;
- deploy/rollback.

## Evidence from production UI

The same order can show:
- admin payment row: receipt expected / verification action;
- admin receipt modal: `Chek yuklanmagan` with a broken image;
- admin order drawer: `Yuklangan chek` while the image itself is broken;
- customer order detail: payment waiting state.

This is a data-contract/runtime consistency failure, not only a visual defect.

## Findings

### P0 — Receipt runtime can use a different API origin

**Root cause:** browser compatibility runtimes had a hardcoded legacy Render API while the active admin application selects its API through `guli_custom_api_url` / `VITE_API_URL`.

**Risk:** stale data, signed URLs resolved by the wrong backend, split-brain admin/customer behavior, difficult incident diagnosis.

**Control:** one active API base per session/runtime.

**Fix:** `public/admin-order-payment-bridge.js` and `public/payment-workflow-guard.js` now resolve the active API base from session configuration, with legacy fallback only as a compatibility fallback.

### P0 — Receipt upload trusted MIME/extension declarations

**Root cause:** the server checked the declared MIME type but did not verify file signatures.

**Risk:** arbitrary content can be stored under an allowed image/PDF type; downstream previewers may process unexpected content.

**Fix:** decode base64, enforce decoded size <= 6 MB, verify JPEG/PNG/WEBP/PDF magic bytes, and derive extension from the MIME type.

### P0 — Payment verification was not tied to receipt existence/state

**Root cause:** admin payment endpoint accepted any supported status without checking the current state or receipt path.

**Risk:** an order could be marked verified without a receipt and invalid transitions could corrupt the payment workflow.

**Fix:** receipt is required before `verified`; transition matrix is enforced server-side.

### P1 — API CORS was unrestricted

**Root cause:** `cors({ origin: true })`.

**Risk:** unnecessary cross-origin exposure of API responses and increased blast radius if a browser-side token is ever exposed.

**Fix:** configurable `CORS_ORIGINS` allowlist with production Vercel origins as defaults.

### P1 — No targeted request throttling

**Root cause:** public admin login, guest-session, promo validation and Telegram webhook paths had no application-level throttle.

**Fix:** bounded in-memory rate limits for the most abuse-prone endpoints. This is a first layer; production edge/WAF rate limiting remains required during Cloudflare migration.

### P1 — Telegram webhook lacked secret-token validation

**Root cause:** webhook route accepted any POST body.

**Fix:** support `TELEGRAM_WEBHOOK_SECRET`, send it to Telegram during webhook registration, and validate `X-Telegram-Bot-Api-Secret-Token` when configured.

### P1 — Guest checkout accepted client-controlled payment/status fields

**Root cause:** guest endpoint copied `payment` and `status` from the request.

**Fix:** guest manual-card checkout now assigns `payment=card_manual` and `status=Qabul qilindi` server-side. Pricing/stock remains delegated to `create_secure_order`.

## Existing controls confirmed

- Telegram Mini App `initData` is HMAC verified server-side.
- Admin endpoints use server-side bearer-token verification.
- Receipt bucket is private.
- Admin receipt access uses a 900-second signed URL.
- `create_secure_order` is the intended server-side price/stock validation path.
- Payment schema uses an explicit four-state model: `pending`, `receipt_uploaded`, `verified`, `rejected`.
- Production SQL repairs are designed to be idempotent and non-destructive.

## Remaining P1/P2 work

1. Move receipt objects from Supabase Storage to Cloudflare R2 only after endpoint-by-endpoint verification.
2. Add persistent/edge rate limiting at Cloudflare Worker/WAF layer; in-memory limits do not survive restarts or multiple instances.
3. Add payment audit log: actor, old status, new status, order id, timestamp, request id.
4. Add automatic orphan receipt cleanup when a receipt is replaced.
5. Add end-to-end test for signed URL retrieval and actual image HTTP 200/content-type.
6. Add webhook replay/idempotency handling keyed by Telegram update ID.
7. Reduce Telegram `initData` replay window after verifying all Mini App clients can refresh correctly.
8. Remove remaining legacy hardcoded API references from non-payment browser runtimes during the API gateway migration.
9. Store admin auth in a hardened server-side/session mechanism rather than long-lived browser `sessionStorage` bearer tokens.

## Required test matrix before merge

### Receipt
- valid JPEG/PNG/WEBP/PDF -> upload 200;
- wrong magic bytes with allowed MIME -> 400;
- >6 MB decoded -> 400;
- missing receipt -> verify 409;
- `pending -> receipt_uploaded` -> allowed;
- `receipt_uploaded -> verified` -> allowed;
- invalid transition -> 409;
- signed URL -> private object, short TTL, no-store response.

### Authorization
- admin endpoint without token -> 401;
- invalid token -> 401;
- customer cannot call admin receipt endpoint;
- customer can only upload receipt for their own Telegram order;
- guest cannot set arbitrary payment/status.

### Origin / abuse
- allowed Vercel origin -> CORS enabled;
- unknown browser origin -> no CORS permission;
- admin login >10/15 min -> 429;
- guest-session >20/min/IP -> 429;
- webhook secret mismatch -> 401.

### UI consistency
- admin payment list and order drawer show the same receipt URL state;
- receipt preview renders an actual image/PDF, not a broken image;
- customer sees `receipt_uploaded` after upload;
- admin verification changes customer state;
- rejected receipt permits replacement;
- no duplicate recovery blocks in admin Telegram WebApp.

## Deployment order

1. CI / Vercel preview green.
2. Test PR preview UI and runtime assets.
3. Deploy backend changes to Render.
4. Set `TELEGRAM_WEBHOOK_SECRET` and `CORS_ORIGINS` in production environment.
5. Verify webhook, receipt upload, signed URL and payment transition APIs.
6. Only then merge PR #13.
7. Production smoke test on the real admin/customer order pair.
8. Keep previous production deployment as rollback until smoke test passes.

**No destructive DB migration is part of this audit patch.**
