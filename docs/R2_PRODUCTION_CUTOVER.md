# GULI MARKET — R2 production media cutover

## Scope

This change moves only the six Supabase Storage media buckets to Cloudflare R2. Supabase Postgres, Auth, Realtime, and application data remain on Supabase.

| Logical bucket | R2 bucket | Object key prefix | Access |
|---|---|---|---|
| `reels-media` | `guli-market-media` | `reels-media/` | Public |
| `video-ads` | `guli-market-media` | `video-ads/` | Public |
| `product-images` | `guli-market-media` | `product-images/` | Public |
| `review-images` | `guli-market-media` | `review-images/` | Public |
| `chat-media` | `guli-market-private` | `chat-media/` | Private |
| `payment-receipts` | `guli-market-private` | `payment-receipts/` | Private |

The prefixes are required because the migration job copied each original bucket into one of the two R2 buckets using the original Supabase bucket name as the leading key segment.

## Runtime environment

Set these variables on the **Render backend service** before deploying this branch:

- `R2_ENDPOINT`: account S3 endpoint, e.g. `https://<account-id>.r2.cloudflarestorage.com`
- `R2_ACCESS_KEY_ID`: R2 Object Read & Write key scoped to both target buckets
- `R2_SECRET_ACCESS_KEY`: matching secret key
- `R2_PUBLIC_BUCKET_NAME=guli-market-media`
- `R2_PRIVATE_BUCKET_NAME=guli-market-private`
- `R2_PUBLIC_URL`: HTTPS custom domain or enabled `r2.dev` public base URL mapped to `guli-market-media` (no trailing slash)

Set `R2_PUBLIC_URL` on **Vercel** as well, because the Vercel catalog function rewrites existing Supabase product-image URLs.

Do not set the private bucket public. Never expose the R2 secret key to Vercel client bundles or browser environment variables.

## Cloudflare R2 configuration

1. Confirm `guli-market-media` has public access enabled through its custom domain or `r2.dev` endpoint.
2. Confirm `guli-market-private` has Public Access disabled.
3. Configure CORS on `guli-market-media` for exact production origins used by GULI MARKET and Telegram WebView:
   - Allowed methods: `GET`, `HEAD`, `PUT`
   - Allowed headers: `Content-Type`, `Cache-Control`, `x-amz-*`
   - Expose headers: `ETag`
   - Set exact origins; do not use wildcard origins with credentials.
4. Private media is uploaded/read by the backend using short-lived SigV4 URLs. Private signed URLs are capped at 1 hour.

## Compatibility behavior

- New product/banner variants, Reels, video ads, review photos, chat attachments, and payment receipts write to R2.
- Existing public Supabase object URLs for the four public buckets are rewritten to the corresponding R2 public URL when returned by catalog, Reels, video-ad, and review APIs.
- Existing private database paths remain unchanged; the private R2 object key is generated as `<logical-bucket>/<stored-path>`.
- Chat application tokens still authorize access before the backend redirects to a short-lived private R2 URL.
- Telegram receipt delivery continues to use short-lived private R2 signed URLs.
- Normal app-managed receipt deletion targets the R2 object after cutover. The one-time Supabase migration source objects are not touched by this code.

## Rollout gates

Do not deploy until:
- Cloudflare public domain and CORS are configured.
- Render has all six R2 environment variables above.
- Vercel has `R2_PUBLIC_URL`.
- CI, backend tests, frontend build, and security tests pass.

After deploy, test:
- Product grid/detail/search images and admin product/banner uploads (all three WebP variants).
- Reels video and poster upload/playback in browser and Telegram Mini App.
- Video-ad video/poster upload and playback.
- Review photo upload and display.
- Chat image/audio/video/document upload, authenticated download, and Telegram delivery.
- Customer receipt upload, customer view, admin view, Telegram notification, and intentional admin receipt deletion.

## Supabase source retention

The 585 original objects in Supabase remain untouched during rollout. Delete them only after the production cutover passes the above tests and a fresh reconciliation confirms all 585 R2 objects are readable. The private backup bucket is separate and must not be deleted as part of this cutover.
