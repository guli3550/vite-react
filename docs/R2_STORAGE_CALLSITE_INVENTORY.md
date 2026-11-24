# GULI MARKET — Supabase Storage call-site inventory

Baseline: `main` at `e79abf90fbc70a626ba1ed087eedb4c31d4f09fe`
Audit branch: `feat/full-r2-storage-migration`
Date: 2026-11-24
Scope: source-code call-site inventory; no production requests or storage mutations performed.

## Bucket inventory

| Bucket | Intended access | Current source-code usage |
|---|---|---|
| `product-images` | Public | Product and banner image derivatives |
| `reels-media` | Public | Reels video/poster uploads |
| `video-ads` | Public | Video-ad media uploads |
| `chat-media` | Private | Customer/admin chat attachments; authenticated proxy/signed access |
| `payment-receipts` | Private | Customer receipts; admin/customer/Telegram signed reads |
| `review-images` | Public | Customer review photos |

These are the six buckets referenced by the backup workflow. The table describes current intended behavior inferred from active code paths; verify actual bucket ACL and CORS settings directly in Cloudflare/Supabase before rollout.

## Upload, read, signed-read and delete call sites

### Public media

- **Product images and banners:** `backend/index.js` — image upload handler creates `product-images` bucket if missing, converts source images into 400/800/1600 WebP variants using Sharp, uploads each variant with Supabase Storage, and persists public URLs in its response. Product and banner upload paths share this handler; database product/banner writes are separate concerns.
- **Reels:** `backend/reelsRuntime.js` — `POST /api/admin/reels/upload-url` creates a Supabase signed upload URL in `reels-media` and returns the public URL. `src/lib/reelsApi.ts` uploads the binary directly with PUT and returns the URL. Reels metadata remains in Supabase Database.
- **Video ads:** `backend/videoAdsRuntime.js` — preferred `POST /api/admin/video-ads/upload-url` creates a Supabase signed upload URL in `video-ads`; legacy `POST /api/admin/video-ads/upload` accepts base64 and uploads through the backend. Both generate public URLs. Video-ad metadata remains in Supabase Database.
- **Review photos:** `backend/canonicalReviewRuntime.js` — active review route uploads to `review-images` and stores public URLs in review metadata. `backend/reviewPatch.js` and `backend/reviewPatchV2.js` also contain similar legacy upload implementations; verify route registration/preload before changing or removing them. Do not assume all similarly named patches are active.

### Private media

- **Chat media:** `backend/chatMediaStorageRuntime.js` — uploads inline customer/admin and Telegram media to private `chat-media`; creates a short-lived Supabase signed URL for Telegram delivery; exposes application-signed proxy URLs and a signed download route that creates a short-lived storage signed URL. Existing identity checks include admin, Telegram initData, GULI JWT, linked/guest chat tokens. Preserve these controls and all allowed MIME types/20 MB limits.
- **Payment receipts:** `backend/paymentReceiptFinalRuntime.js` — authoritative receipt upload writes `payment-receipts`, updates `orders.payment_receipt_path`, and returns a 24-hour signed URL. The same runtime has an admin receipt deletion route that removes the object from Supabase and clears the DB path/status; this is a business action and must not accidentally delete original Supabase objects during migration.
- **Payment receipt compatibility/other paths:** `backend/manualCardPaymentPatch.js` and `backend/authenticatedCardPaymentPatch.js` contain upload and/or signed-read code. `backend/customerNotificationService.js` creates signed URLs for customer Telegram notifications. Telegram admin modules (including `backend/telegramAdminBotProduction.js`, `backend/telegramAdminBotV2Patch.js`, and related patch variants) create signed receipt URLs for bot messages. Verify active route ownership and bot preload chain before switching each call site.

## Important migration constraints found in code

1. The current media path values are not uniform: some database columns store full public URLs (`products.image`, `reels.video_url`, video-ad URLs, review photo URLs), while chat and payment records store object paths/tokens (`media_path`, `payment_receipt_path`). Compatibility resolution must understand both.
2. Public URLs cannot be used for chat attachments or payment receipts. These buckets must remain private in R2 and use short-lived signed GET URLs or authenticated proxy streaming.
3. Telegram bot delivery depends on temporary signed download URLs. R2 signed GET URL generation must be tested with Telegram fetch behavior, expiry, and content type.
4. Product/banner WebP derivatives are created server-side. Migration must preserve all three variants and the current response fields (`url`, `variants`, `srcSet`, `mimeType`, `path`).
5. Reels and video-ad direct browser uploads require exact CORS origins and PUT permission. CORS must be validated for production and Telegram WebView origins without using wildcard origins.
6. Existing records may contain Supabase absolute URLs, Supabase object paths, application proxy URLs, or Telegram URLs. Never assume a database field is always a bare R2 key.
7. Existing admin receipt deletion behavior is separate from one-time migration cleanup. During migration, do not delete Supabase originals or backup objects. If a customer/admin intentionally removes a migrated receipt, define a safe dual-store policy and audit trail first.

## New isolated R2 adapter (not wired to production)

`backend/r2MediaStorage.js` currently provides:
- Environment/config validation for an HTTPS S3 endpoint and scoped credentials.
- Key validation against absolute paths, traversal segments, backslashes, control characters, and empty path segments.
- SigV4 presigned GET, PUT, and HEAD URLs (1–3600 seconds).
- Explicit public URL generation only when `R2_PUBLIC_URL` is configured.
- PUT upload and HEAD metadata verification helpers with non-2xx responses surfaced as errors.

It does not create buckets, list objects, delete objects, access Supabase, change database rows, or initialize itself in the production server. The adapter is intentionally not wired into any runtime yet.

## Test coverage added

`tests/r2-media-storage.test.mjs` covers:
- Key traversal rejection.
- HTTPS endpoint and required credential validation.
- Deterministic SigV4 URL structure and method separation.
- Public URL encoding and no-public-base behavior for private buckets.
- HEAD/PUT method, metadata, and error handling.

The tests use injected time/fetch and do not contact Cloudflare or Supabase.

## Remaining Phase 0 checks before caller migration

- Confirm actual Supabase bucket ACLs, allowed MIME types, size limits, CORS, and object counts for all six buckets.
- Enumerate every object and capture byte size, content type, cache-control, ETag, and SHA-256; reconcile against the private R2 backup manifest.
- Confirm active route owners and exact backend preload order for duplicate receipt/review implementations.
- Trace product/banner database writers and all image consumers (catalog cards, detail pages, search, cart, admin preview, feeds, Google Merchant feed).
- Trace chat client URL consumers and Telegram bot send methods, including documents/audio/video.
- Confirm current R2 bucket names, private bucket strategy, CORS and public domain mapping with the account owner. No credentials or account IDs belong in source control.

## Safety status

- Adapter is isolated and not enabled in production.
- No production environment variables changed.
- No Supabase Storage objects, database rows, or buckets changed.
- No R2 production media object written by this work.
- No Supabase original deletion is authorized.


## Live Supabase Storage inventory snapshot (2026-11-24)

Read-only workflow: `Supabase Storage read-only object inventory`
Run: https://github.com/guli3550/vite-react/actions/runs/45357433737

The workflow successfully enumerated the six target buckets and found no extra buckets:
- Actual bucket count: 6
- Missing target buckets: 0
- Unplanned buckets: 0
- Total objects: 585
- Total object bytes: 337,959,271
- Unknown object sizes: 0
- No object names were emitted; no file contents were downloaded; no Storage data was modified.

| Bucket | Public | Objects | Bytes | Actual configured size limit |
|---|---:|---:|---:|---:|
| `reels-media` | yes | 74 | 176,725,828 | 100 MiB |
| `video-ads` | yes | 38 | 53,233,835 | 50 MiB |
| `chat-media` | no | 101 | 45,994,297 | 8 MiB |
| `payment-receipts` | no | 97 | 35,851,394 | 6 MiB |
| `product-images` | yes | 271 | 25,976,422 | 3,000,000 bytes |
| `review-images` | yes | 4 | 177,495 | not set |

### Important live mismatch — chat-media

The active chat storage runtime declares a 20 MiB maximum and allows audio/video/document MIME types. The live Supabase bucket is configured for only 8 MiB and its current allowlist contains image and document types but omits the audio/video types declared by the runtime. The runtime's `ensureBucket()` attempts to update the bucket but catches update failures and continues. Therefore the code's 20 MiB capability is not proof that production Storage accepts 20 MiB or all declared types.

This must be resolved deliberately before chat-media migration: verify the exact Supabase bucket update error and decide the target R2 private bucket limits. Do not silently expand production Supabase bucket settings as part of this R2 migration.

### Backup reconciliation status

The live read-only inventory totals (585 objects / 337,959,271 bytes) exactly match the previously completed R2 backup job totals (585 files / 337,959,271 bytes). The R2 backup's independent verifier also passed its manifest-to-object SHA-256 checks. Matching live source counts/bytes plus backup manifest verification is strong evidence of a complete backup, but it is not a fresh byte-for-byte comparison against the live Supabase objects; do not describe it as a direct source-vs-backup SHA-256 comparison.
