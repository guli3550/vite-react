# GULI MARKET — Full Supabase Storage to Cloudflare R2 migration

Status: Phase 0 audit complete; implementation not yet deployed.
Base: `main` at `e79abf90fbc70a626ba1ed087eedb4c31d4f09fe`
Working branch: `feat/full-r2-storage-migration`

## Non-negotiable safety rules

- Do not delete, empty, rename, or overwrite any Supabase Storage bucket/object during migration.
- Do not change Supabase database, Auth, Realtime, or SQL schema as part of this Storage-only migration.
- Preserve existing public URLs and private-file access semantics until every consumer has been migrated and verified.
- Keep the independently verified R2 backup in `guli-market-backup` immutable; production media belongs in the separate `guli-market-media` bucket.
- No production deploy or Supabase deletion until the acceptance checklist in this document is satisfied and the owner gives a separate explicit deletion approval.

## Verified current state

- Production still reads Supabase Storage URLs: the 2026-11-24 production smoke catalog response included product image URLs on `qttwufydrvdwmhxcpgjb.supabase.co/storage/v1/object/public/product-images/...`.
- The previous preview branch `feat/cloudflare-r2-media-migration` contains a SigV4 presigned PUT helper and partial migration for Reels/video ads; it is 12 commits ahead and 22 behind current `main`, so it must not be merged wholesale.
- The previous preview migration document explicitly leaves chat media, payment receipts, and review images on Supabase. Its product/banner image conversion note is not sufficient proof that production writes were migrated.
- Storage callers found on current `main` include:
  - Reels: `backend/reelsRuntime.js`, `src/lib/reelsApi.ts` (uses `reels-media`).
  - Video ads: `backend/videoAdsRuntime.js` (uses `video-ads`).
  - Chat media: `backend/chatMediaStorageRuntime.js`, `public/chat-media-bridge.js`, `public/chat-media-download-runtime.js` (uses `chat-media`; signed/private download behavior must be preserved).
  - Payment receipts: `backend/paymentReceiptFinalRuntime.js`, `backend/manualCardPaymentPatch.js`, `backend/authenticatedCardPaymentPatch.js`, `backend/customerNotificationService.js`, Telegram admin notification/bot modules (uses `payment-receipts`; private signed URLs and retention/history must be preserved).
  - Review images: `backend/reviewPatch.js`, `backend/reviewPatchV2.js`, `backend/canonicalReviewRuntime.js` (uses `review-images`).
  - Product and banner media: upload/read logic is also present in `backend/index.js`; all product fields, gallery arrays, banner URLs, and admin upload flows must be traced before changing the writer.
- Backup already exists in private R2 bucket `guli-market-backup`: 585 objects / 337,959,271 bytes; two independent read-only verification runs succeeded with matching SHA-256 values. This backup is not the production media bucket.

## Required target design

- One shared backend R2 storage adapter for object keys, presigned PUT, public URLs, private presigned GET, HEAD/metadata checks, and safe key validation.
- Production media bucket: `guli-market-media`; backup bucket remains separate.
- Public media classes: product images, banners, Reels video/posters, video-ad media, and review images only where current access is public.
- Private media classes: chat attachments and payment receipts. These must not be exposed through a public bucket URL; use short-lived signed GET URLs or authenticated proxy streaming.
- Keep database metadata in Supabase. Store canonical R2 object keys in metadata where feasible, while retaining legacy Supabase URL/path compatibility during transition.
- A compatibility resolver must support existing Supabase URLs and new R2 keys/URLs, so old records continue to load while new uploads go to R2.

## Implementation phases

1. **Phase 0 — inventory (read-only):** enumerate every bucket/object and every code path that uploads, reads, signs, deletes, or sends a media URL. Record public/private ACL expectations, content types, size limits, and DB columns.
2. **Phase 1 — shared R2 adapter:** harden key encoding and SigV4; add presigned PUT and private GET/HEAD; enforce bucket/prefix allowlists and expiry limits; unit-test canonical request/signature behavior. No caller switches yet.
3. **Phase 2 — new uploads to R2:** migrate Reels, video ads, product images, banners, and reviews in isolated changes. Keep Supabase database writes intact. Add upload completion verification (HEAD/size/content-type) before saving metadata.
4. **Phase 3 — private media:** migrate chat attachments and payment receipts with private object access, short-lived signed downloads, Telegram bot compatibility, and ownership checks. Never make these buckets public.
5. **Phase 4 — legacy object copy and metadata compatibility:** copy old Supabase objects to R2 using deterministic keys; verify every object by byte size and SHA-256; update metadata only after each object has a verified R2 counterpart. Keep old URLs/objects intact during this phase.
6. **Phase 5 — production acceptance:** verify browser, Telegram Mini App, admin uploads, product galleries, banners, Reels playback, video ads, reviews, chat image/video/document download, payment receipt preview, and Telegram admin notifications. Check R2 CORS for exact production origins and monitor error rates.
7. **Phase 6 — retirement readiness:** produce a per-bucket report of remaining Supabase URL/path references and prove zero production reads/writes for a defined observation window. Request a separate explicit owner approval before any Supabase Storage deletion. No deletion is authorized by this plan.

## Acceptance criteria before any Supabase Storage deletion

- All six source buckets have a complete object inventory and verified R2 counterparts.
- Every copied object has matching byte length and SHA-256.
- Database metadata and application resolvers point to R2 or safely resolve legacy keys.
- No active production code path uploads to or downloads from Supabase Storage.
- Production E2E tests pass on both browser and Telegram Mini App for all six media classes.
- Private chat/payment media cannot be fetched without valid authorization or an unexpired signed URL.
- No Supabase Storage object is deleted until the owner separately confirms the exact bucket(s) and understands the irreversible impact.

## Current decision

Proceed with Phase 1 adapter and test design only after the full Phase 0 object/path inventory is complete. Production remains unchanged. Supabase Storage originals remain untouched.
