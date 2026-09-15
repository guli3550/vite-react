# GULI — FINAL CENTRALIZED AUTH ARCHITECTURE

**Status:** Canonical target architecture
**Purpose:** This document is the source of truth for future GULI authentication and identity work. Do not introduce a parallel authentication model without explicitly updating this architecture.

## 1. Core principle

Browser, Telegram Bot, and Telegram Mini App must use one backend and one canonical `public.users` identity record.

- Business identity: normalized real phone number (`E.164`, e.g. `+998901234567`)
- Technical primary key: `users.id` UUID
- Verified Telegram identity: `users.telegram_id` UNIQUE nullable
- Authorization: short-lived JWT access token + rotating/revocable refresh token
- Email/password authentication: deprecated and must not be used for the new customer identity flow
- Frontend must never use phone number, Telegram ID, or order number as an authorization credential

## 2. Canonical data model

### `public.users`

```sql
create table if not exists public.users (
    id uuid primary key default gen_random_uuid(),
    phone_number text not null unique,
    telegram_id bigint unique,
    full_name text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
```

### `public.auth_sessions`

```sql
create table if not exists public.auth_sessions (
    session_id uuid primary key default gen_random_uuid(),
    telegram_id bigint,
    phone_number text,
    otp_hash text,
    is_verified boolean not null default false,
    otp_used boolean not null default false,
    otp_attempts integer not null default 0,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);
```

Recommended lifecycle states for implementation: `WAITING`, `CONTACT_RECEIVED`, `OTP_SENT`, `VERIFIED`, `EXPIRED`, `BLOCKED`.

### `public.auth_refresh_tokens`

```sql
create table if not exists public.auth_refresh_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    token_hash text not null unique,
    expires_at timestamptz not null,
    revoked_at timestamptz,
    created_at timestamptz not null default now()
);
```

RLS should remain enabled. Browser/Mini App must not access these tables directly; all protected identity operations go through the backend.

## 3. Browser authentication flow

```text
Browser
  -> POST /api/v1/auth/init-session
  -> backend creates short-lived auth session
  -> backend returns Telegram deep link
  -> user opens Telegram Bot
  -> /start auth_SESSION_ID
  -> bot requests Contact Share
  -> user sends own Telegram contact
  -> backend validates contact ownership and binds telegram_id + phone
  -> backend creates 6-digit OTP, stores only otp_hash
  -> OTP expires in 3 minutes
  -> browser submits POST /api/v1/auth/verify-otp
  -> backend atomically verifies single-use OTP
  -> find/create canonical users row
  -> issue access + refresh tokens
```

### Optional passwordless completion

The browser may poll `GET /api/v1/auth/check-status/:session_id`. After the bot verifies the contact, the backend should expose only a short-lived, one-time exchange ticket—not raw JWTs through the polling endpoint. Browser exchanges the ticket for access/refresh tokens.

## 4. Telegram Bot authentication

The `/start auth_SESSION_ID` handler must:

1. Parse and validate the session ID.
2. Confirm the session exists and has not expired.
3. Store `msg.from.id` as the Telegram identity for the session.
4. Show a `request_contact=true` button.
5. Accept `msg.contact.phone_number` only after validating that the contact belongs to the same Telegram user (`contact.user_id === msg.from.id` when supplied, with the message/context checks required by the Bot API).
6. Normalize the phone to E.164.
7. Generate a cryptographically secure 6-digit OTP.
8. Store only the OTP hash, never plaintext OTP.
9. Enforce 3-minute expiry, single-use semantics, and attempt limits.

## 5. Telegram Mini App direct flow

Mini App sends Telegram `initData` to:

`POST /api/v1/auth/telegram`

Backend must validate Telegram `initData` cryptographically using the bot token before trusting the Telegram user ID. `initData` does not itself provide the user's phone number. If the canonical user already exists by verified `telegram_id`, issue JWT immediately. If not, require a verified Contact Share flow to obtain the phone number, then create/link the canonical user.

## 6. Account linking rules

The canonical identity is the normalized phone number, while `users.id` remains the immutable technical primary key.

- Existing phone + same Telegram ID -> update/link and continue.
- Existing phone + different Telegram ID -> reject automatic linking; require an explicit secure account-recovery/linking procedure.
- Existing Telegram ID + different phone -> do not silently overwrite the phone; require explicit verified linking/recovery logic.
- New phone + verified Telegram ID -> create a new user.
- Never allow client-supplied `phone`, `telegram_id`, `order_number`, or URL parameters to bypass authentication.

## 7. Canonical API surface

```text
POST /api/v1/auth/init-session
POST /api/v1/auth/verify-otp
GET  /api/v1/auth/check-status/:session_id
POST /api/v1/auth/telegram
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

All protected business APIs must resolve the current user from the verified JWT `sub` claim.

## 8. Order authorization

Canonical rule:

```text
Authorization: Bearer <access-token>
        -> verify JWT
        -> users.id = JWT.sub
        -> orders.user_id = users.id
```

Phone number, Telegram ID, order number, or localStorage values may be filters/identifiers only after authorization and ownership checks. They must never be authorization credentials.

## 9. Centralized Telegram notification architecture

Status, payment, receipt, and online-chat notifications must use one notification layer and the canonical `users` identity:

```text
Business event
   -> Notification Service
   -> users.id
   -> users.telegram_id
   -> Telegram Bot API
```

Do not create separate identity stores for browser, bot, Mini App, orders, payments, or chat.

Existing `orders.telegram_id` fields may be retained temporarily during migration for compatibility, but the long-term source of truth is `users.telegram_id`. Notifications must not depend on stale client metadata.

Required notification events include:

- order status changed
- payment verified/rejected
- receipt-related customer event when applicable
- online chat message

Notification delivery must be idempotent and should use an event key/outbox or equivalent durable mechanism so retries cannot create uncontrolled duplicates.

## 10. Security requirements

- OTP lifetime: 3 minutes.
- OTP: cryptographically random 6 digits.
- OTP stored only as a keyed hash/HMAC.
- OTP is single-use and invalidated immediately after successful verification.
- Maximum OTP attempts per session: 5.
- OTP resend cooldown: approximately 60 seconds.
- Rate-limit by IP, session, and Telegram identity.
- Auth session lifetime: approximately 5 minutes.
- Access JWT: approximately 15 minutes.
- Refresh token: approximately 30 days, stored hashed and revocable; rotate on refresh.
- Use constant-time comparison for hashes/signatures.
- Validate Telegram Mini App `initData` server-side before trusting Telegram identity.
- Never expose bot token, Supabase service-role key, or JWT signing secrets to the frontend.
- Do not return raw OTPs from APIs or logs.
- Do not put JWTs in URLs.
- Prefer secure, HttpOnly, SameSite cookies for browser refresh/session material where compatible with the existing app; keep access tokens out of URLs.
- Add audit logging for account linking, login success/failure, OTP abuse, refresh/revoke, and security-sensitive identity changes.

## 11. Migration rule for GULI

Do not replace the current production auth/order/payment/chat system with a destructive rewrite. Migrate incrementally:

1. Introduce canonical `users`, `auth_sessions`, and `auth_refresh_tokens`.
2. Implement Telegram Bot authentication and verified contact linking.
3. Implement Mini App `initData` verification and direct login for already-linked users.
4. Implement Browser deep-link + OTP flow.
5. Add JWT middleware and migrate protected APIs to `users.id` ownership.
6. Migrate order/payment/chat/notification identity lookups to `users.telegram_id`.
7. Add idempotent centralized notification service.
8. Verify production smoke tests for authenticated customer flows.
9. Only after successful migration, disable/deprecate legacy email/password/guest identity routes.
10. Remove obsolete auth patches only after dependency and production verification.

## 12. Non-negotiable invariants

```text
ONE backend
ONE canonical users table
ONE customer identity
ONE authorization model
ONE Telegram identity link

Browser + Bot + Mini App
          -> users.id
          -> JWT
          -> protected APIs

Business event
          -> users.id
          -> users.telegram_id
          -> Telegram Bot
```

Any future authentication implementation that conflicts with these invariants must be treated as a regression unless this architecture document is intentionally revised.

## 13. Implementation note for the current GULI repository

The repository currently contains multiple auth, customer, Telegram, order, chat, payment, and notification runtime patches. Future work should consolidate behavior behind the canonical architecture rather than adding another independent authentication path. The existing production security fixes must be preserved while migration is performed.
