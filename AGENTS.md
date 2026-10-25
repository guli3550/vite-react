# GULI — ECC Agent Operating Contract

This repository is the production GULI PREMIUM Telegram Mini App / online market.

## Canonical architecture

`Telegram Mini App / Browser → Vercel storefront → Render API → Supabase`

- Frontend: Vite/React on Vercel
- Public URL: `https://vite-react-seven-inky-10.vercel.app`
- Admin UI: `/admin`
- Backend/API: Render service `guli-lingerie-api`
- Database/auth/storage/realtime: Supabase
- Telegram: Bot API + Mini App `initData`
- Payments: cash + manual HUMO/UZCARD receipt workflow

## ECC execution policy

When ECC is available, use specialized agents instead of treating every task as a single undifferentiated coding task.

### Default workflow

1. **Planner / Architect** — inspect the existing GULI architecture and define the smallest safe change.
2. **Database Reviewer** — required for Supabase schema, RLS, realtime, queries, migrations, or data integrity changes.
3. **Security Reviewer** — required for auth, Telegram `initData`, admin access, secrets, payments, webhooks, CORS, RLS, or external API changes.
4. **Frontend Reviewer** — required for storefront/admin UI, routing, state, responsive behavior, or UX changes.
5. **Build/Error Resolver** — use when build, TypeScript, lint, runtime, or deployment failures appear.
6. **E2E / Verification** — verify the affected user journey before considering the task complete.
7. **Code Reviewer** — perform a fresh-context review of the final diff before merge.

## GULI-specific safety rules

- Never expose backend secrets in Vite client code, Git history, browser storage, or Telegram messages.
- Treat `VITE_*` variables as public.
- Never use Render as the storefront URL; Render is backend-only.
- Telegram Mini App and product links must use the canonical Vercel URL.
- Persistent chat data belongs in the backend/Supabase `chat_messages` flow; browser localStorage/BroadcastChannel are UI helpers only.
- Do not change production database/RLS/realtime behavior without identifying the exact SQL migration and rollback path.
- Do not change payment or order state transitions without tests covering success, failure, duplicate submission, and retry behavior.
- Preserve existing admin/customer parity unless the task explicitly changes the contract.
- Prefer additive, reversible changes over destructive refactors.

## Verification gates

Before merge/deploy, run the applicable checks:

- `npm run build`
- Backend install/build/start checks when backend files changed
- Relevant unit/integration tests
- E2E/smoke checks for changed production journeys
- Security review for security-sensitive changes
- Fresh-context code review of the final diff

A task is not complete merely because the code compiles. The changed behavior must be verified against the production architecture and its affected customer/admin flow.

## Audit mode

For production audit work, produce findings in this order:

`finding → severity → evidence/file → root cause → exact change → test → deploy/rollback → post-deploy verification`

Do not hide known blockers behind cosmetic improvements.
