# GULI ONE SERVER — Canonical Architecture

## Priority

P0. This is the primary architecture target for the production consolidation.

## Non-negotiable invariants

1. There is one canonical GULI API/business-logic server.
2. Browser, Telegram Mini App, Telegram Bot/Webhook, and future mobile clients use the same canonical API and identity model.
3. Cloudflare is an edge/DNS/proxy layer only; it must not become a second business-logic backend.
4. Vercel is frontend/static delivery only; it must not be an alternate API origin.
5. Supabase PostgreSQL/Storage/Realtime remains the canonical data layer unless a controlled migration explicitly changes it.
6. `public.users` is the canonical customer identity table.
7. Telegram is the only customer authentication provider.
8. Email/password and Google authentication are disabled at the API boundary. Legacy email columns/data are preserved until a controlled data migration proves they can be retired safely.
9. Client-provided `telegram_id`, phone, `auth_user_id`, order ownership, prices, or privileged roles are never trusted as identity/authorization inputs.
10. Telegram Mini App `initData` is validated server-side and is used only to bootstrap/bind the canonical GULI session; business APIs authorize with the canonical GULI session/JWT.
11. Logout must invalidate the canonical GULI session; client-side localStorage removal is not the security boundary.

## Target flow

```text
Browser / Safari / Yandex / other browser
                    \
Telegram Mini App -----> Cloudflare edge/proxy -----> GULI Canonical Server
Telegram Bot/Webhook   /                                      |
Mobile client         /                                       |
                                                           Supabase
                                                    PostgreSQL / Storage / Realtime
```

## Authentication flow

```text
Telegram Bot / Mini App
        |
        | verified Telegram identity
        v
canonical auth server
        |
        | verified contact/phone when required
        v
public.users
        |
        | canonical session
        v
GULI JWT/session
        |
        +---- Browser API
        +---- Mini App API
        +---- Orders
        +---- Payments
        +---- Reviews
        +---- Chat
        +---- Profile
        +---- Admin authorization (separate role/permission checks)
```

## Migration strategy

### Phase P0.1 — single API origin

- Browser API calls use only the canonical API origin.
- Remove direct Render fallback from browser runtime.
- Route Vercel `/api/*` through the canonical gateway.
- Keep Cloudflare/Worker as a transparent proxy until the custom GULI domain is ready.

### Phase P0.2 — Telegram-only auth boundary

- Reject legacy email/password and Google login endpoints.
- Preserve legacy database columns for compatibility.
- Keep Telegram Contact Share verification and canonical `public.users` binding.

### Phase P0.3 — identity convergence

- Reconcile `public.users`, `public.customers`, and `public.telegram_users` by verified Telegram ID and verified phone.
- Do not delete rows during reconciliation.
- Add explicit migration/audit records for every merge.
- Make `public.users` the only authorization identity.

### Phase P0.4 — session convergence

- Browser and Mini App receive the same canonical GULI session model.
- Telegram `initData` is not a permanent authorization substitute.
- Logout invalidates the canonical session.

### Phase P0.5 — backend consolidation

- Replace runtime monkey-patching/route stacking with explicit Express routes and middleware.
- Migrate one domain at a time: auth -> users -> orders -> payments -> reviews -> chat -> admin.
- Remove obsolete patches only after route parity and production smoke tests pass.

### Phase P0.6 — production cutover

- Custom GULI domain points to the canonical server through Cloudflare.
- One public API origin remains.
- Old direct Render API access is blocked or restricted so clients cannot bypass the canonical edge/API path.
- Production smoke tests verify browser, Mini App, bot webhook, auth, order, receipt, review, and admin paths.

## Current known blockers

- The repository still contains a large runtime patch/preload chain.
- Legacy email/Google auth code remains in the backend, although a boundary guard now rejects its public routes.
- `public.users`, `public.customers`, and `public.telegram_users` contain overlapping identity records and require controlled reconciliation.
- The deployed API is currently Render behind the Cloudflare gateway; this is the transitional implementation of the one-canonical-server model, not the final custom-domain cutover.

## Safety rule

Do not replace the current production schema with the V2 ZIP schema in one operation. The previous integration audit found incompatible table/API contracts and explicitly requires incremental migration behind existing production contracts.
