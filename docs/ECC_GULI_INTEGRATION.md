# ECC + GULI integration

GULI is prepared for Everything Claude Code (ECC) project-aware agent workflows.

## What is connected in the repository

- `AGENTS.md` defines the GULI architecture, safety rules, agent responsibilities, and verification gates.
- The workflow is aligned to ECC's specialized planner/architect, database, security, frontend, build-repair, E2E/verification, and code-review roles.
- Production-specific constraints are explicit so an agent does not accidentally expose secrets, move the storefront to Render, or change Supabase/payment behavior without verification.

## Install ECC in Codex

ECC's current official Codex installation is a native marketplace/plugin installation. The upstream project documents:

```bash
codex plugin marketplace add affaan-m/ECC
codex plugin add ecc@ecc
codex plugin list --json
```

After installation, open this repository in Codex. Codex reads the root `AGENTS.md`; ECC supplies the specialized skills/agents and its verification/security workflows.

Do not combine the native Codex plugin with ECC's deprecated sync installer.

## Recommended GULI workflow

For a production bug or feature:

1. Planner/Architect — map the affected frontend → Render API → Supabase path.
2. Implement with TDD where practical.
3. Database Reviewer — if Supabase/data/RLS/realtime is involved.
4. Security Reviewer — if auth, Telegram, payment, secrets, CORS, webhooks, or RLS is involved.
5. Frontend Reviewer — for storefront/admin UX and responsive behavior.
6. Build/Error Resolver — when CI/build/runtime errors exist.
7. E2E/Verification — validate the affected customer/admin journey.
8. Code Reviewer — fresh-context final review.

## Production rule

ECC is a development/agent orchestration layer. It is not deployed into the Vercel storefront or Render API runtime. The GULI application remains unchanged at runtime except for repository configuration and any code changes explicitly made by an agent.
