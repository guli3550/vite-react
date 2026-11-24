# GULI MARKET — Cloudflare R2 media migration (Preview)

## Scope in this branch

- Reels video and poster uploads use short-lived Cloudflare R2 presigned PUT URLs.
- Video-ad video and poster uploads use short-lived Cloudflare R2 presigned PUT URLs.
- Product and banner images continue to be normalized to responsive WebP variants by the backend, then uploaded to R2.
- Existing Supabase objects and database rows are not deleted or rewritten. Existing URLs remain valid until an explicit, separately reviewed migration is performed.
- Chat media, payment receipts, and review images remain on their existing storage paths in this phase.

## Render environment

Keep the existing values and add:

- `R2_PUBLIC_URL=https://pub-03a02e4eb19747dfb7e440384ccc3a7f.r2.dev`

Required existing variables:

- `R2_ENDPOINT`: account S3 endpoint, without bucket suffix.
- `R2_BUCKET_NAME=guli-market-media`
- `R2_ACCESS_KEY_ID`: scoped S3 access key.
- `R2_SECRET_ACCESS_KEY`: matching secret key.

Do not put credentials in source control, screenshots, or chat. The helper uses the R2 S3 endpoint with region `auto` and path-style bucket addressing.

## Bucket CORS

In Cloudflare R2 > guli-market-media > Settings > CORS Policy, configure:

- Allowed origins:
  - `https://gulii.uz`
  - `https://www.gulii.uz`
  - `https://vite-react-git-feat-cloudflare-r2-media-migration-guli3550.vercel.app`
  - `https://vite-react-pa2of4cyv-guli3550.vercel.app` (current deployment URL; add if opening this exact URL)
  - Add the exact Vercel Preview origin used for this PR.
- Allowed methods: `GET`, `HEAD`, `PUT`
- Allowed headers: `content-type`, `cache-control`
- Expose headers: `etag`
- Max age: `3600`

If another deployed frontend origin is used, add that exact origin. Avoid wildcard origins for production.

## Preview validation checklist

1. Confirm backend startup succeeds with the R2 variables.
2. Upload one small product image and confirm 400/800/1600 WebP variants return HTTP 200.
3. Upload one Reels poster and one small Reels video; confirm the public URLs load.
4. Upload one video-ad poster and one small video; confirm the public URLs load.
5. Confirm admin authentication is required for every upload URL endpoint.
6. Confirm Supabase product/reels/video-ad metadata writes still work. R2 replaces media object storage only; it does not replace Supabase database access.
7. Do not merge or deploy to production until the Preview checks pass and the Supabase project restriction is resolved.

## Important limitation

R2 media migration does not remove the current Supabase database restriction (`exceed_cached_egress_quota`). Product catalog queries and application metadata still depend on Supabase. The Supabase owner must restore project access separately.
