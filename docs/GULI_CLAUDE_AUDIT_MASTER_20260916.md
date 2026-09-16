# GULI — CLAUDE AUDIT MASTER

**Date:** 2026-09-16
**Purpose:** Single source of truth for the Claude/AI audit findings, fixes, unresolved defects, architecture decisions, verification gates, and the step-by-step remediation program for the GULI production system.
**Repository:** `guli3550/vite-react`
**Default branch:** `main`

> This document consolidates the audit material available from the prior GULI audit conversations and the audit documents already committed to the repository. It is a working master record, not a claim that every historical chat transcript has been reproduced verbatim.

---

# 1. MASTER OPERATING RULE

Every future GULI audit/fix must follow this sequence:

`READ → VERIFY → ROOT CAUSE → MINIMAL FIX → TEST → DEPLOY → PRODUCTION SMOKE TEST → CLOSE FINDING`

Every finding must be recorded as:

`finding → severity → evidence/file → root cause → exact change → test → deploy/rollback → post-deploy verification`

**Important:** a code change or successful CI run is not a production PASS until the real deployed flow has been tested.

---

# 2. CANONICAL PRODUCTION ARCHITECTURE

## 2.1 Target invariants

1. One canonical GULI API/business-logic server.
2. Browser, Safari, Yandex, Telegram Mini App, Telegram Bot/Webhook and future mobile clients use the same canonical API and identity model.
3. Cloudflare is edge/DNS/proxy only; it must not become a second business-logic backend.
4. Vercel is frontend/static delivery only; it must not become an alternate API origin.
5. Supabase PostgreSQL/Storage/Realtime remains the canonical data layer unless an explicit controlled migration changes it.
6. `public.users` is the canonical authorization identity.
7. Telegram is the only customer authentication provider in the final architecture.
8. Email/password and Google authentication are rejected at the API boundary; legacy database fields/data may remain temporarily for controlled migration.
9. Client-provided `telegram_id`, phone, `auth_user_id`, order ownership, prices or privileged roles are never trusted for authorization.
10. Telegram Mini App `initData` is validated server-side and is used to bootstrap/bind the canonical GULI session; business APIs authorize using the canonical GULI session/JWT.
11. Logout invalidates the canonical server session; localStorage/sessionStorage deletion is not the security boundary.
12. No client can select another user's order by supplying another phone number, Telegram ID, UUID, order number or auth-user ID.

## 2.2 Target request flow

```text
Browser / Safari / Yandex / other browser
                 \
Telegram Mini App ----> Cloudflare edge/proxy ----> GULI Canonical Server
Telegram Bot/Webhook  /                                  |
Mobile client        /                                   |
                                                        Supabase
                                                 PostgreSQL / Storage / Realtime
```

## 2.3 Authentication flow

```text
Telegram Bot / Mini App
        |
        | server-verified Telegram identity
        v
GULI auth server
        |
        | verified contact/phone when required
        v
public.users
        |
        | canonical GULI session/JWT
        v
Browser / Mini App APIs
        |
        +-- Orders
        +-- Payments / Receipts
        +-- Reviews
        +-- Chat
        +-- Profile
        +-- Admin (separate role/permission checks)
```

---

# 3. AUDIT HISTORY

## 3.1 2026-09-01 — Production Payment / Receipt / Admin Security Audit

Repository document: `docs/GULI_PRODUCTION_AUDIT_V1_PAYMENT_SECURITY.md`.

### Main findings

- Receipt runtime could use a different API origin from the active admin application.
- Receipt upload trusted declared MIME/extension instead of file signatures.
- Payment verification was not tied tightly enough to receipt existence/current state.
- CORS was unrestricted (`origin: true`).
- Abuse-prone endpoints lacked targeted application-level throttling.
- Telegram webhook lacked secret-token validation.
- Guest checkout accepted client-controlled payment/status values.

### Controls/fixes recorded

- Active API base resolution was centralized for payment/admin compatibility runtimes.
- Receipt upload validates decoded size and JPEG/PNG/WEBP/PDF magic bytes.
- Receipt extension is derived from validated MIME type.
- Payment state transitions require the correct receipt/state conditions.
- Production CORS uses an allowlist.
- Bounded rate limits were added to high-risk endpoints.
- `TELEGRAM_WEBHOOK_SECRET` validation was added.
- Guest manual-card checkout sets payment/status server-side.
- Telegram Mini App `initData` is HMAC-verified server-side.
- Admin endpoints use server-side bearer-token verification.
- Receipt storage is private; admin receipt access uses short-lived signed URLs.
- `create_secure_order` is the intended server-side price/stock validation path.

### Remaining work from this audit

- Persistent/edge rate limiting at Cloudflare/WAF level.
- Payment audit log: actor, old state, new state, order ID, timestamp, request ID.
- Orphan receipt cleanup.
- End-to-end signed URL/content-type verification.
- Telegram webhook replay/idempotency keyed by update ID.
- Reduce Telegram `initData` replay window after client verification.
- Remove remaining hardcoded legacy API references.
- Harden admin authentication storage/session handling.

---

## 3.2 2026-09-11 — AI Agent Audit Start

Repository document: `docs/AI_AGENT_AUDIT_START.md`.

### Specialist lanes

1. Architect/Planner — production contracts and smallest safe changes.
2. Database — Supabase schema, RLS, realtime and integrity.
3. Security — Telegram initData, admin authorization, secrets, payment/webhook/CORS.
4. Chat/Agent — persistent `chat_messages` and safe AI-agent insertion points.
5. Frontend — customer/admin parity and AI Operations Center.
6. QA — production smoke/regression gates.
7. Code Reviewer — fresh-context review before merge.

### AI safety rule

Do not put an autonomous AI agent directly into customer chat before authorization, tool boundaries, audit logging, human handoff and failure behavior are verified. The first production-safe AI milestone is an internal Admin AI Operations Center.

---

## 3.3 2026-09-13 — Customer Identity / Orders / Telegram Admin Bot / Payment Notification Audit

Repository document: `docs/GULI_PRODUCTION_AUDIT_V1_1_CUSTOMER_IDENTITY.md` (current repository content is the v1.2 revision).

### Browser customer authentication/order work

Implemented:

- Live Supabase session bridge for protected customer order/payment APIs.
- Telegram Mini App requests prefer verified Telegram `initData`.
- Customer order/payment requests use `cache: no-store`.
- Browser session bootstrap before React order loading.
- Canonical `GULI-######` order-number normalization.
- UUIDs no longer replace a real order number in customer-facing cards when available.
- Card payment state is normalized so card orders are not rendered as `Naqd` incorrectly.
- Browser payment-status synchronization and deduplicated notifications.

Observed unresolved condition:

- Earlier production browser tests still showed `Buyurtmalarim = 0` while Telegram/admin views contained the order. This requires fresh deployed-build verification.

### Telegram customer/order identity

Implemented:

- Canonical Web App URL enforcement.
- Stale Vercel aliases removed from intended canonical menu flow.
- Canonical `GULI-######` order display.
- Browser/Telegram synchronization aligned around the same order identity.

Fresh Telegram cache/deployment verification remains required.

### Telegram admin bot

Implemented:

- Separate admin bot integration with secret token held in environment, not source.
- `telegram_admin_bot_chats` persistence.
- `telegram_admin_bot_events` durable event records.
- `telegram_admin_bot_order_messages` durable order-message mapping.
- One durable admin order message per admin chat/order.
- Customer/order/payment/server/address information composition.
- Product media + customer receipt media.
- Approve/Reject inline buttons wired to `admin_payment_decision` RPC.
- In-place Telegram message editing after decision.
- Customer Telegram payment-status notification.
- Online-chat admin notifications.
- Duplicate-notification hardening.
- Telegram `attach://` media-edit repair.
- Durable receipt-history storage.
- Order totals/payment normalization.

Known production failure:

- Approval test produced `Bad Request: can't parse InputMedia: media not found` in an earlier production build.
- Duplicate admin messages were observed in earlier tests.
- New dedupe/repair layers were added, but a fresh order must be tested after the latest deployment.

### Customer notification bridge

Implemented:

- Admin payment decision → customer Telegram notification path.
- Admin order-status → customer notification path.
- Durable event keys/dedupe.
- Browser notification synchronization.
- Overlapping duplicate notifier path was subsequently disabled.

Status: requires fresh end-to-end verification.

---

# 4. CRITICAL AUTH / IDOR AUDIT

## 4.1 Original critical IDOR

A critical Insecure Direct Object Reference issue was identified around order lookup.

The unsafe pattern allowed client-controlled identifiers such as phone/order number/Telegram ID to influence order retrieval.

### Recorded fix

Commit `696313c` changed `GET /api/orders` so order retrieval is based on server-verified identity (`telegram_id` or `auth_user_id`) instead of arbitrary client-supplied lookup values.

## 4.2 Regression discovered

Later audit found that `backend/guliProductionOrderFix.js` and the `routeRegistry` monkey-patching system could override or bypass the secure handler.

This means the source-level fix alone was not sufficient: runtime route registration had to be audited.

### Root architectural problem

The backend accumulated a large runtime patch/preload chain, including dozens of patch modules. Multiple interceptors and wrappers made route precedence difficult to reason about and created regression risk.

### Required remediation

- Identify the actual route handler registered at runtime.
- Remove client-controlled ownership selectors.
- Use one canonical server authorization middleware.
- Replace route monkey-patching with explicit Express routes/middleware incrementally.
- Do not delete a patch merely because it looks obsolete; first prove route parity with tests.

---

# 5. FINAL AUTHENTICATION ARCHITECTURE AUDIT

The intended final model was established as:

`Telegram verified identity → auth_sessions → GULI server JWT/session → canonical user → all business APIs`

### Explicit decisions

- Email authentication is removed from the customer authentication model.
- Google authentication is removed from the customer authentication model.
- Supabase Phone Auth/Twilio is not the final customer authentication mechanism.
- Telegram Contact Share must be used for verified phone binding when phone verification is required.
- A phone number sent as an ordinary bot text message must not be treated as verified ownership.
- The canonical identity is `public.users.id`.
- Legacy `customers` and `telegram_users` data is retained during controlled reconciliation.

### Session security model

- Short-lived access token (recorded target: 15 minutes).
- Long-lived refresh token (recorded target: 30 days).
- Refresh tokens are hashed and rotated.
- Auth-session claim must be atomic and single-use where applicable.
- Sensitive APIs verify session/ownership server-side.

### Recorded implementation/fix commits

- `6f3572a` — RPC-only secure orders/no fallback.
- `c5983f1` — related secure order-path hardening.
- `30ed499f` / `4318b0b` — verified Telegram phone boundary.
- `0e103048` — email/Google/password boundary rejected with fail-closed 410 behavior.
- `989cd4c`, `0d8dab5`, `2299e949`, `a017d21c` — auth-session atomic/single-use protections.

Relevant runtime files recorded in the audit:

- `guliCustomAuth.js`
- `guliFinalAuthRuntime.js`
- `customerOrdersSyncPatch.js`
- `authenticatedCardPaymentPatch.js`

---

# 6. IDENTITY DATA MODEL

## Canonical

`public.users`

## Legacy/transition tables

- `public.customers`
- `public.telegram_users`
- `orders.auth_user_id`

### Migration rule

Do not blindly merge/delete records.

Use:

1. verified Telegram ID;
2. verified phone when required;
3. explicit migration/audit records;
4. reversible migration steps;
5. ownership tests before and after reconciliation.

No authorization decision may depend on an unverified client-provided identity field.

---

# 7. RECEIPT / PAYMENT AUDIT

## Required state model

```text
pending
   ↓
receipt_uploaded
   ↓
verified

receipt_uploaded → rejected
rejected → receipt_uploaded
```

Invalid transitions must be rejected server-side.

### Receipt upload requirements

- Decode base64 before validation.
- Maximum decoded size: 6 MB (recorded audit requirement).
- Validate magic bytes, not only declared MIME.
- Supported audited types: JPEG, PNG, WEBP, PDF.
- Derive extension from validated content type.
- Store receipt objects privately.
- Signed URLs must be short-lived.
- Customer can upload only for their own authorized order.
- Admin access is separately authorized.
- Replacement must not leave untracked/orphaned receipt objects.

### Known failure history

The receipt endpoint `/api/orders/:id/receipt` previously produced `Failed to fetch` and inconsistent behavior due to combinations of:

- endpoint mismatch;
- Supabase Storage configuration/bucket issues;
- MIME validation;
- runtime patch fallbacks;
- base64 handling;
- split API origins.

Fake-success fallbacks were identified and removed/hardened. A failed real storage operation must not be reported as successful.

---

# 8. ORDER SYNCHRONIZATION AUDIT

## Known issues

- Browser order history previously showed zero while Telegram/admin had the order.
- Multiple frontend fetch wrappers existed.
- Telegram initialization timing could race with order loading.
- Stale local/cache data could overwrite fresh server data.
- Overlapping polling could race with realtime updates.
- Shared state and merge behavior could preserve stale order collections.
- UUIDs were sometimes displayed instead of canonical order numbers.

## Required architecture

- One canonical order API.
- One canonical order identity: `order_number` for customer display.
- Server-derived ownership.
- Live authenticated session before protected order load.
- `cache: no-store` for sensitive order/payment reads.
- Supabase Realtime as event stream, not authorization.
- Deterministic merge/upsert logic.
- No stale localStorage identity may override a valid live identity.

---

# 9. TELEGRAM ADMIN BOT AUDIT

## Required guarantees

For every new order:

1. Exactly one durable admin notification per admin chat/order.
2. Product media is valid before Telegram sends/edits the message.
3. Receipt media is valid when present.
4. Approve/Reject buttons operate on the same canonical order.
5. Admin decision reaches the server-side payment RPC.
6. The existing Telegram message is updated rather than producing uncontrolled duplicates.
7. Customer receives one corresponding status/payment notification.
8. Event IDs and order-message mappings survive worker restart.
9. Telegram webhook updates are idempotent.

## Known historical failure

`Bad Request: can't parse InputMedia: media not found`

This must be treated as a production verification item until a fresh order proves the media path works after deployment.

---

# 10. ADMIN AUTH / SECURITY

Required controls:

- Server-side verification of admin credentials/tokens.
- Unsigned admin tokens must never be accepted.
- Privileged roles are server-derived.
- No admin secret/token in Vite/client source.
- Telegram admin bot token remains environment-only.
- Admin authentication should not rely on long-lived browser bearer tokens in `sessionStorage` as the final architecture.
- Audit actor and authorization decision for privileged actions.

A bot token used during configuration should be rotated if it was exposed during setup.

---

# 11. API / CORS / WEBHOOK SECURITY

Required controls:

- One canonical API origin.
- Production CORS allowlist.
- Unknown browser origins do not receive CORS permission.
- Telegram webhook secret validation.
- Telegram update idempotency/replay protection.
- Edge/WAF rate limiting for public abuse-prone endpoints.
- No client-controlled payment/status/price/stock/ownership fields.

---

# 12. RUNTIME PATCH / BACKEND CONSOLIDATION AUDIT

## Problem

The backend accumulated a large number of runtime patches loaded during startup. The audit recorded roughly 37 patch modules in the startup chain at one stage.

This produced:

- route precedence uncertainty;
- duplicate interceptors;
- hidden behavior changes;
- difficult rollback;
- difficult security review;
- possibility that a secure route is overridden later by a legacy patch.

## Required migration

Consolidate domain-by-domain:

1. Auth
2. Users/identity
3. Orders
4. Payments/receipts
5. Reviews
6. Chat
7. Admin
8. Telegram notifications

For each domain:

- identify all patches;
- identify actual runtime route/middleware;
- create a canonical implementation;
- write regression tests;
- deploy;
- verify production;
- only then remove obsolete patches.

---

# 13. GITHUB / CI AUDIT

Known repository/permission history:

- Repository: `guli3550/vite-react`.
- GitHub write access was previously read-only/403 in some sessions.
- Write access was subsequently confirmed.
- Audit branch used: `audit/write-access-test-20260916`.
- Test commit recorded: `3e305080...`.
- `main` was intentionally left unchanged during that access test.

The repository now has sufficient write permission for the master audit file and future controlled fixes.

### CI rule

GitHub Actions must be treated as a verification layer, not as proof of production correctness.

Required CI coverage should include:

- build;
- lint/type checks where applicable;
- auth boundary tests;
- IDOR ownership tests;
- receipt validation tests;
- payment transition tests;
- Telegram webhook secret/idempotency tests;
- canonical API-origin/static checks;
- no secret leakage checks.

---

# 14. CURRENT KNOWN BLOCKERS / OPEN FINDINGS

## P0 — Must be resolved before declaring production security complete

### P0.1 Runtime route override / IDOR regression risk

**Evidence:** secure order handler can be affected by `guliProductionOrderFix.js` / route registry monkey-patching.

**Required:** prove runtime handler and remove client-controlled ownership selectors.

### P0.2 Canonical authentication boundary

**Required:** Telegram-only customer auth; verified Contact Share phone; canonical `public.users`; no email/Google/password path.

### P0.3 Canonical session ownership

**Required:** every protected order/payment/receipt operation derives identity from verified server session.

### P0.4 Receipt endpoint real-success guarantee

**Required:** no fake-success fallback; real Storage upload and authorization verified end-to-end.

### P0.5 One canonical API origin

**Required:** remove remaining browser hardcoded API origins and eliminate client bypass paths.

## P1 — Must be resolved during production hardening

- Persistent Cloudflare/WAF rate limiting.
- Payment audit log.
- Telegram webhook update idempotency.
- Receipt orphan cleanup.
- Signed URL HTTP 200/content-type E2E test.
- Hardened admin session storage.
- Identity reconciliation with audit records.
- Remove obsolete runtime patch modules after route parity tests.
- Final browser order-history E2E test.
- Final Telegram order/approval/media E2E test.

## P2 — Structural cleanup

- Remove stale legacy frontend wrappers.
- Reduce duplicated notification paths.
- Consolidate API clients.
- Simplify startup preload chain.
- Document all production environment variables.
- Add regression tests for every previously observed production failure.

---

# 15. MASTER TEST MATRIX

## Authentication

- Telegram Mini App `initData` valid → session bootstrap succeeds.
- Invalid/forged `initData` → reject.
- Ordinary text phone message → never considered verified contact ownership.
- Email/password → rejected at API boundary.
- Google auth → rejected at API boundary.
- Access token expired → refresh/session handling behaves correctly.
- Refresh token replay → rejected.
- Logout → canonical session invalidated.

## Authorization / IDOR

- User A can read own order.
- User A cannot read User B's order by UUID.
- User A cannot read User B's order by order number.
- User A cannot read User B's order by phone.
- User A cannot read User B's order by Telegram ID.
- User A cannot upload a receipt to User B's order.
- Client cannot assign itself another `auth_user_id`.

## Receipt

- Valid JPEG/PNG/WEBP/PDF → success.
- Wrong magic bytes with allowed MIME → 400.
- >6 MB decoded → 400.
- Missing receipt → payment verification rejected.
- Valid state transitions → success.
- Invalid transitions → 409.
- Private storage object cannot be anonymously fetched.
- Signed URL expires.
- Receipt replacement works and old orphan cleanup is recorded.

## Orders

- Authenticated browser sees own orders after reload.
- Telegram Mini App sees same orders as browser for same canonical user.
- Admin sees authorized order.
- Customer sees canonical `GULI-######` identifier.
- No stale UUID replaces order number.
- Realtime status update reaches customer UI.
- Polling and realtime do not duplicate/erase state.

## Telegram admin bot

- One new order → one admin message per admin chat.
- Product media renders.
- Receipt media renders when present.
- Approve works.
- Reject works.
- Existing message updates correctly.
- Customer receives one notification.
- Worker restart does not duplicate notification.
- Duplicate Telegram update does not create duplicate order event.

## API / deployment

- Allowed origin → CORS permitted.
- Unknown origin → CORS denied.
- Webhook secret mismatch → 401.
- Webhook replay → ignored/idempotent.
- Direct legacy API bypass is blocked/restricted at final cutover.
- Vercel frontend uses canonical API only.
- Cloudflare is proxy/edge only.

---

# 16. STEP-BY-STEP REMEDIATION PROGRAM

## STEP 0 — Freeze and establish baseline

- Do not introduce unrelated UI/features.
- Record current `main` commit.
- Run CI.
- Record current Render/Vercel production versions.
- Record Supabase migration state.
- Capture current failing E2E flows.

**Exit:** reproducible baseline exists.

## STEP 1 — Runtime route truth

- Trace startup preload chain.
- List every patch that touches auth/orders/receipts.
- Determine final runtime route registration.
- Identify duplicate handlers/interceptors.
- Prove the effective `/api/orders` and receipt handlers.

**Exit:** one documented effective handler per protected route.

## STEP 2 — Close IDOR permanently

- Remove all client-controlled ownership selectors.
- Require canonical server session or verified Telegram identity bootstrap.
- Add A/B cross-user tests for UUID, order number, phone, Telegram ID.

**Exit:** all ownership tests pass.

## STEP 3 — Finish Telegram-only auth

- Keep Telegram Contact Share as verified phone mechanism.
- Reject ordinary phone text as verification.
- Keep email/Google/password fail-closed.
- Make `public.users.id` canonical.

**Exit:** auth matrix passes.

## STEP 4 — Session hardening

- Verify access token/session.
- Enforce refresh rotation.
- Reject replay.
- Invalidate logout server-side.
- Verify sensitive API session ownership.

**Exit:** session abuse tests pass.

## STEP 5 — Receipt/payment hardening

- Verify content signature/size.
- Enforce state machine.
- Enforce ownership.
- Verify private storage and signed URLs.
- Remove every fake-success fallback.

**Exit:** receipt/payment matrix passes against deployed backend.

## STEP 6 — Canonical API origin

- Search repository for legacy/hardcoded API origins.
- Route browser traffic through one canonical API.
- Keep Vercel as frontend only.
- Keep Cloudflare as edge/proxy only.

**Exit:** static audit + browser network verification pass.

## STEP 7 — Order synchronization

- Bootstrap live session before order loading.
- Remove stale identity overrides.
- Use `cache: no-store` for sensitive reads.
- Fix deterministic realtime/polling merge.
- Verify browser and Telegram parity.

**Exit:** same canonical user sees the same order set in both clients.

## STEP 8 — Telegram admin notification consolidation

- One notification producer.
- Durable event claim.
- Durable order-message mapping.
- Valid media references.
- Idempotent webhook updates.
- Approve/Reject through one payment RPC.

**Exit:** fresh-order E2E has no duplicate and no `InputMedia media not found` error.

## STEP 9 — Identity reconciliation

- Map `customers`, `telegram_users`, and `users` only with verified identity evidence.
- Record merges.
- Do not delete blindly.
- Re-test historical orders.

**Exit:** one authorization identity with preserved historical data.

## STEP 10 — Remove runtime patch debt

- Consolidate one domain at a time.
- Add route parity tests.
- Remove obsolete patches only after production verification.

**Exit:** explicit route/middleware architecture with no hidden security overrides.

## STEP 11 — Production edge hardening

- Cloudflare WAF/rate limiting.
- Webhook protection.
- Restrict direct backend bypass where appropriate.
- Final custom domain cutover.

**Exit:** one public canonical application path.

## STEP 12 — Final production certification

Run the complete matrix on the deployed production versions:

`Telegram login → canonical session → /api/v1/auth/me → orders → receipt upload → admin decision → customer notification → realtime status → logout`

**Final rule:** no production-ready verdict until every P0 and required P1 E2E gate is verified on the live deployment.

---

# 17. IMPORTANT COMMITS / CHECKPOINTS

- `696313c` — recorded IDOR/order authorization fix.
- `6f3572a` — RPC-only secure orders/no fallback.
- `c5983f1` — secure order-path hardening.
- `30ed499f` / `4318b0b` — verified Telegram phone boundary.
- `0e103048` — fail-closed email/Google/password boundary.
- `989cd4c` / `0d8dab5` / `2299e949` / `a017d21c` — auth-session hardening.
- `2f5f2d3` through `67a70ae` — 2026-09-13 browser/Telegram/admin-bot/payment-notification work recorded in the production audit.
- `67a70ae` — recorded current main HEAD at the 2026-09-13 audit checkpoint.
- `3e305080...` — GitHub write-access audit test checkpoint.

**Important:** commit presence is evidence of code history, not proof that the deployed production behavior is correct.

---

# 18. REFERENCE AUDIT DOCUMENTS

- `docs/AI_AGENT_AUDIT_START.md`
- `docs/GULI_PRODUCTION_AUDIT_V1_PAYMENT_SECURITY.md`
- `docs/GULI_PRODUCTION_AUDIT_V1_1_CUSTOMER_IDENTITY.md`
- `GULI_ONE_SERVER_ARCHITECTURE.md`
- `FINAL_AUTH_ARCHITECTURE.md` (when present in the active repository/history)

This master document is intended to become the starting point for every subsequent Claude/AI audit session so the remediation work continues from verified state instead of restarting the audit.

---

# 19. CURRENT WORKING STATUS — 2026-09-16

**Overall:** remediation in progress.

**Do not declare final production readiness yet.**

Immediate next target:

1. Verify effective runtime route handlers.
2. Eliminate remaining IDOR/runtime override risk.
3. Run live Telegram-only auth E2E.
4. Run live browser order E2E.
5. Run live receipt upload/verification E2E.
6. Run live Telegram admin approval/media E2E.
7. Only after these pass, consolidate/remove runtime patches.

**Master principle:** fix the root cause once, verify it in the real deployed system, then move to the next stage.
