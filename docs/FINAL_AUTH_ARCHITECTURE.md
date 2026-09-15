# GULI — FINAL CENTRALIZED AUTH ARCHITECTURE

**Status:** Canonical target architecture
**Purpose:** Source of truth for GULI authentication and identity. Do not introduce a parallel customer authentication model without explicitly updating this document.

## 1. Core principle

Browser, Telegram Bot, Telegram Mini App, and all future clients use **one backend, one database, and one canonical `public.users` identity record**.

The future custom domain must not create a separate application identity. Whether the customer opens GULI through the official domain, Telegram Mini App, Telegram Bot, Chrome, Safari, Yandex Browser, Android/iOS webview, or a future native app, all authenticated business data must resolve to the same canonical user.

- Business identity: normalized real phone number (`E.164`, e.g. `+998901234567`)
- Technical primary key: `users.id` UUID
- Verified Telegram identity: `users.telegram_id` UNIQUE nullable
- Authorization: GULI server-signed short-lived JWT access token + rotating/revocable refresh token
- Supabase Phone Auth/SMS: **not required** for the canonical customer login flow
- Email/password authentication: deprecated and blocked at the customer route boundary
- Frontend must never use phone number, Telegram ID, or order number as an authorization credential

### One Backend + One Database + One Canonical Identity

```text
                         GULI CUSTOM DOMAIN
                            guli.uz
                               |
                 +-------------+-------------+
                 |                           |
          Web / Browser                api.guli.uz
       Chrome / Safari / Yandex             |
                 |                    Cloudflare Gateway
                 |                           |
                 +-------------+-------------+
                               |
                         ONE BACKEND API
                               |
                         ONE DATABASE
                         Supabase PostgreSQL
                               |
                         public.users
                               |
                           users.id
                               |
          +--------------------+--------------------+
          |                    |                    |
       Browser            Telegram Mini App     Telegram Bot
          |                    |                    |
          +--------------------+--------------------+
                               |
                       SAME CUSTOMER ACCOUNT
```

**Non-negotiable rule:** changing the client, browser, device, domain, or entry point must never by itself create a second customer identity or a second business database.

## 2. Future domain architecture

When the production domain is purchased, use it as the public entry point without changing the canonical identity model.

```text
https://guli.uz
        -> frontend

https://api.guli.uz
        -> Cloudflare Gateway
        -> Render Backend
        -> Supabase PostgreSQL
```

Telegram Mini App, Telegram Bot, browser, Safari, Yandex Browser, and future clients must call the same canonical API layer (`api.guli.uz` in production).

A domain migration is configuration/routing work, not an account/database migration.

## 3. Canonical data model

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
    exchange_ticket_hash text,
    exchange_ticket_used boolean not null default false,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
);
```

The OTP is an **internal one-time verification primitive**. It is not shown to the customer in the canonical browser flow; the verified Telegram Contact event causes the browser's one-time exchange ticket to be accepted automatically.

Recommended lifecycle states: `WAITING`, `CONTACT_RECEIVED`, `READY`, `VERIFIED`, `EXPIRED`, `BLOCKED`.

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

RLS remains enabled. Browser/Mini App must not access these tables directly; protected identity operations go through the backend.

## 4. Browser authentication flow — canonical

```text
Browser
  -> POST /api/v1/auth/init-session
  -> backend creates unique 5-minute auth session
  -> backend returns session_id + one-time exchange ticket + Telegram deep link
  -> user opens Telegram Bot
  -> /start auth_<SESSION_ID>
  -> bot binds this exact session to msg.from.id
  -> bot requests Contact Share
  -> user sends own Telegram contact
  -> backend validates contact.user_id === msg.from.id
  -> backend stores verified phone + Telegram ID on that exact session
  -> backend creates internal OTP hash / READY state
  -> browser polls its own session_id
  -> READY => POST /api/v1/auth/exchange with one-time exchange ticket
  -> backend verifies ticket + session + identity
  -> find/create canonical users row
  -> issue GULI access JWT + rotating refresh token
  -> browser stores customer session and continues automatically
```

The browser must never receive a raw OTP from the polling endpoint. The exchange ticket is bound to one `session_id`, expires with the session, and is single-use.

### Concurrent-user isolation

Every browser login attempt gets a unique UUID `session_id`. Telegram contact verification must resolve only to the matching active session. No global or "latest unbound session" fallback may be introduced.

## 5. Telegram Bot authentication

The `/start auth_SESSION_ID` handler must:

1. Parse and validate the session ID.
2. Confirm the session exists and has not expired.
3. Bind `msg.from.id` to that exact auth session.
4. Show a `request_contact=true` button.
5. Accept `msg.contact.phone_number` only when the contact belongs to the same Telegram user (`contact.user_id === msg.from.id`).
6. Normalize the phone to E.164.
7. Generate a cryptographically secure internal 6-digit OTP and store only its keyed hash.
8. Mark the session ready for the one-time browser exchange.
9. Never accept a manually typed phone number as proof of ownership.
10. Never guess an auth session from a plain `/start` command.

## 6. Telegram Mini App direct flow

Mini App sends Telegram `initData` to the canonical backend authentication layer. The backend must validate `initData` cryptographically using the bot token before trusting the Telegram user ID.

`initData` does not itself provide the user's phone number. If the canonical user already exists by a verified `telegram_id`, the backend may issue the GULI JWT directly. If not, require a verified Contact Share flow to obtain and bind the phone number.

## 7. GULI customer JWT

The canonical browser/Mini App session is issued by the **GULI backend**, not by Supabase Phone Auth.

```text
JWT header:  { alg: HS256, typ: JWT }
JWT claims:  sub, phone, telegram_id, role=customer, iat, exp, jti
Access TTL:  approximately 15 minutes
Refresh TTL: approximately 30 days
```

The signing secret is server-only (`AUTH_JWT_SECRET`). It must never be bundled into Vite, returned by `/api/auth/config`, logged, or sent to Telegram/browser clients. Refresh tokens are stored only as keyed hashes and are rotated/revoked on use.

Supabase remains the durable PostgreSQL/user registry and stores the canonical `users.id`; the GULI JWT is the customer authorization credential used by the protected backend API layer.

## 8. Account linking rules

The canonical identity is the normalized phone number, while `users.id` remains the immutable technical primary key.

- Existing phone + same Telegram ID -> update/link and continue.
- Existing phone + different Telegram ID -> reject automatic linking; require explicit secure account recovery/linking.
- Existing Telegram ID + different phone -> do not silently overwrite the phone.
- New phone + verified Telegram ID -> create a new canonical user.
- Never allow client-supplied `phone`, `telegram_id`, `order_number`, or URL parameters to bypass authentication.

## 9. Canonical API surface

```text
POST /api/v1/auth/init-session
GET  /api/v1/auth/check-status/:session_id
POST /api/v1/auth/exchange
POST /api/v1/auth/verify-otp        # internal/controlled compatibility path
POST /api/v1/auth/telegram          # Mini App direct flow
POST /api/v1/auth/refresh
POST /api/v1/auth/logout             # required finalization endpoint
GET  /api/v1/auth/me
```

All protected customer APIs must resolve the current user from the verified GULI JWT `sub` claim. Supabase Auth JWT verification is retained only as a backward-compatibility path during migration.

## 10. Order authorization

Canonical rule:

```text
Authorization: Bearer <GULI access-token>
        -> verify GULI JWT
        -> users.id = JWT.sub
        -> orders.auth_user_id = users.id
```

Phone number, Telegram ID, order number, or localStorage values may be identifiers only after authentication and ownership checks. They must never be authorization credentials.

## 11. Centralized Telegram notification architecture

```text
Business event
   -> Notification Service
   -> users.id
   -> users.telegram_id
   -> Telegram Bot API
```

Do not create separate identity stores for browser, bot, Mini App, orders, payments, or chat.

Existing `orders.telegram_id` fields may be retained temporarily for compatibility, but the long-term source of truth is `users.telegram_id`. Notifications must not depend on stale client metadata.

Required notification events include order status changes, payment verified/rejected, receipt events when applicable, and online-chat messages. Delivery should be idempotent using an event key/outbox or equivalent durable mechanism.

## 12. Security requirements

- Auth session lifetime: approximately 5 minutes.
- Internal OTP: cryptographically random 6 digits, keyed-hash only, single-use, max 5 attempts.
- Access JWT: approximately 15 minutes.
- Refresh token: approximately 30 days, hashed, revocable, rotated on refresh.
- Rate-limit by IP, session, and Telegram identity.
- Validate Telegram Mini App `initData` server-side before trusting Telegram identity.
- Never expose Telegram bot token, Supabase service-role key, or JWT signing secret to the frontend.
- Never return raw OTPs from APIs or logs.
- Never put JWTs in URLs.
- Prefer secure HttpOnly SameSite cookies for long-lived browser credentials when the client architecture permits; current GULI localStorage access-token compatibility must not leak secrets to URLs.
- Audit account linking, login success/failure, OTP abuse, refresh/revoke, and sensitive identity changes.
- Customer email/password/Google routes remain disabled at the phone-only boundary.

## 13. Migration rule for GULI

Do not perform a destructive rewrite of production auth/order/payment/chat. Migrate incrementally:

1. Keep canonical `users`, `auth_sessions`, and `auth_refresh_tokens`.
2. Use Telegram Bot verified Contact Share for browser identity proof.
3. Issue GULI server-signed JWTs without depending on Supabase Phone Auth/SMS.
4. Migrate protected customer APIs to GULI JWT `sub` + `orders.auth_user_id` ownership.
5. Keep Supabase Auth JWT validation temporarily for already-issued legacy sessions.
6. Migrate Mini App `initData` direct authentication to the same GULI JWT layer.
7. Migrate order/payment/chat/notification identity lookups to `users.id` / `users.telegram_id`.
8. Add centralized idempotent notification delivery.
9. Configure the future custom domain and canonical `api.<domain>` gateway without changing user identity records.
10. Verify production smoke tests from browser and Telegram Mini App.
11. Remove obsolete auth patches only after dependency and production verification.

## 14. Non-negotiable invariants

```text
ONE public production domain / canonical web entry point
ONE API gateway
ONE backend
ONE database
ONE canonical users table
ONE customer identity
ONE authorization model
ONE Telegram identity link

Browser + Safari + Yandex + other browsers
Telegram Bot + Telegram Mini App
Future Android/iOS/native clients
                |
                v
             users.id
                |
           GULI JWT
                |
         protected APIs
                |
          business data
```

A user who authenticates through one supported client and then another must resolve to the same `users.id` when the verified identity-linking rules match. Client, browser, device, or domain must never determine business identity.

Any future authentication implementation that conflicts with these invariants is a regression unless this architecture document is intentionally revised.

## 15. Current repository implementation status

The repository still contains multiple historical runtime patches. The canonical path is now the GULI server-signed JWT flow described above. Future work must consolidate behavior behind this architecture rather than adding another authentication system. Existing production IDOR, receipt, order-status, and phone-only boundary fixes must be preserved while legacy patches are retired incrementally.
