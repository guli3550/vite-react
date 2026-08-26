# GULI Cloudflare Gateway

This Worker is an optional fast edge gateway in front of the existing Render API. It does **not** replace the backend until the migration is verified.

## Local validation

From `cloudflare-worker/`:

```bash
npx wrangler deploy --dry-run
```

## First deployment

1. Open Cloudflare Dashboard → Workers & Pages → Create → Worker.
2. Deploy the `cloudflare-worker` directory using the Wrangler configuration in this folder, or connect the GitHub repository and select this Worker.
3. Keep `BACKEND_URL` as `https://guli-lingerie-api.onrender.com`.
4. Add `TELEGRAM_BOT_TOKEN` as a **Worker Secret**. Never put the token in GitHub.
5. Copy the resulting `https://<worker-name>.<account>.workers.dev` URL.

## Smoke tests before changing the frontend

```text
GET  /api/health
GET  /api/products?limit=20
GET  /api/products/<product_code>
POST /api/telegram/webhook (Telegram will call this after webhook configuration)
```

Expected gateway health response includes:

```json
{"success":true,"status":"online","gateway":"cloudflare","coldStart":false}
```

## Important migration rule

Do **not** change `VITE_API_URL`, Telegram Menu Button URL, webhook URL, or Supabase redirect URLs until the Worker URL has been independently tested. Keep the existing Vercel/Render production path as rollback during migration.

## Telegram webhook

The current Render runtime configures the webhook at `/api/telegram/webhook`. During migration, point Telegram to the Worker URL only after the Worker has the `TELEGRAM_BOT_TOKEN` secret and `/api/telegram/webhook` returns HTTP 200.

## Rollback

If the Worker fails, restore the existing frontend API URL and Telegram webhook URL to the Render endpoint. No database rollback is required.
