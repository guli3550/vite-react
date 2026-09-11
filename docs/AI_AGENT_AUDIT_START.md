# GULI AI Agent Audit — Start

Date: 2026-09-11

## Operating mode

This audit uses the ECC-style specialist workflow defined in `AGENTS.md`. The user does not have a local computer/Codex runtime, so the repository is being audited and changed through the connected cloud development environment.

## Specialist lanes

1. Architect/Planner — map production contracts and smallest safe changes.
2. Database — inspect Supabase schema, RLS, realtime and data integrity before DB changes.
3. Security — inspect Telegram initData, admin authorization, secrets, payment/webhook/CORS boundaries.
4. Chat/Agent — inspect the persistent `chat_messages` flow and design safe AI-agent insertion points.
5. Frontend — inspect customer/admin parity and the future AI Operations Center surface.
6. QA — define production smoke/regression gates.
7. Code Reviewer — fresh-context review before merge.

## First target

Do not deploy an AI agent directly into customer chat until authorization, tool boundaries, audit logging, human handoff, and failure behavior are defined. The intended first production-safe milestone is an internal Admin AI Operations Center that can observe agent activity and issue controlled tasks; customer-facing autonomous replies come only after verification.

## Production contracts to preserve

- Vercel is the public storefront.
- Render remains backend-only.
- Supabase is the persistent data layer.
- `chat_messages` remains the source of truth for persistent chat.
- Backend secrets never enter Vite/client code.
- Payment/order state transitions require duplicate/retry/failure coverage.
- Database/RLS/realtime changes require explicit migration and rollback path.

## Audit output

Every finding must be recorded as:

`finding → severity → evidence/file → root cause → exact change → test → deploy/rollback → post-deploy verification`
