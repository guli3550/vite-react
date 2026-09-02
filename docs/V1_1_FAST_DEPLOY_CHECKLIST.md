# GULI V1.1 Fast Deploy Gates

1. Canonical API runtime loads before application runtimes.
2. Telegram auth runtime routes protected API requests through the Gateway.
3. Only public GET catalog/geocode endpoints may fall back to Render.
4. Run `npm run audit:api` and `npm run build`.
5. CI backend/browser syntax and payment security checks must pass.
6. Verify Vercel + Gateway + Render production smoke.
7. Verify Supabase reservation lifecycle before merging payment lifecycle changes.
8. Deploy only the verified main branch.
