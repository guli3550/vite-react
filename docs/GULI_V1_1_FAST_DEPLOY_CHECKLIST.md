# GULI V1.1 Fast Deploy Checklist

## Architecture
- Vercel frontend/admin
- Cloudflare Gateway
- Render backend
- Supabase database/storage

## Required gates
1. `npm run audit:api`
2. `npm run build`
3. Existing backend/browser syntax and payment security CI checks
4. Production smoke: Vercel + Gateway + Render health/catalog/auth
5. Supabase payment reservation lifecycle manual tests

## Payment lifecycle
- checkout reserves stock/promo exactly once
- rejected/timeout releases exactly once
- rejected + replacement receipt re-reserves
- insufficient stock blocks re-reserve
- verified never releases

## Deployment rule
Do not merge PR #15. Keep PR #16 and PR #17 isolated until their required manual/production gates are green. Deploy only from the verified main branch to Vercel/Render/Cloudflare.
