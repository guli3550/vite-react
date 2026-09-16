# GULI — Expanded Single-Server Migration

## P0 objective

All customer-facing business traffic must use one canonical GULI API/business server. Cloudflare is edge/proxy only. Vercel serves the frontend. Supabase remains the canonical data layer.

```text
Browser / Safari / Yandex / Telegram Mini App / Bot
                         |
                         v
                Cloudflare Edge
                  (proxy only)
                         |
                         v
                 GULI Canonical API
                         |
                         v
                Supabase DB/Storage
```

## Non-negotiable invariants

1. No frontend direct calls to Render or another backend origin.
2. No business logic in Cloudflare Worker.
3. Telegram is the only customer authentication mechanism.
4. Browser authentication uses the canonical GULI session/JWT bound to `public.users`.
5. Mini App `initData` is verified server-side and is used only to bootstrap/bind the canonical session.
6. Client-supplied `telegram_id`, phone, order owner, price, role, or auth identity is never trusted.
7. `public.users` is the canonical customer identity table.
8. Legacy `customers`/`telegram_users` data is retained until reconciliation is complete; no destructive merge is performed automatically.
9. Logout must invalidate the canonical server session, not only hide client state.
10. Telegram webhook traffic must terminate in the canonical API path.

## Migration gates

### Gate A — Edge

- Cloudflare Worker performs proxy/CORS/transport functions only.
- No `/start`, `/shop`, database access, Telegram business handling, or product business rules in Worker.

### Gate B — API

- One canonical backend process owns routes and business rules.
- Direct backend access is not used by clients.
- Health response identifies the canonical server.

### Gate C — Auth

- Email/password/Google customer login endpoints remain blocked.
- Telegram verification is server-side.
- Canonical user is resolved from `public.users.id`.

### Gate D — Identity

- Reconcile `public.users`, `public.customers`, and `public.telegram_users` by verified Telegram ID and unambiguous phone matches.
- Conflicts are audited, not guessed or deleted.

### Gate E — Runtime consolidation

- Replace the current preload/monkey-patch chain with explicit modules registered by one server entry point.
- Remove a patch only after its endpoint behavior has an equivalent canonical module and production smoke test.

### Gate F — Cutover

- Configure the final production domain to the Cloudflare edge.
- Point the edge to the selected canonical API host.
- Keep Render as a migration origin only until cutover verification is complete.
- Update Telegram webhook to the final canonical public API URL.

## Current state

The repository now routes frontend `/api/*` traffic through the Cloudflare gateway and the gateway acts as a transport proxy. The backend still contains a large historical runtime patch chain; that chain is the next consolidation target. No destructive identity merge is part of this migration step.
