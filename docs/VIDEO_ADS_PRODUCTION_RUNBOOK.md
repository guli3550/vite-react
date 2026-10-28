# Guli Market Video Ads — Production Runbook

## Current deployment targets discovered during the audit

- Repository: https://github.com/guli3550/vite-react
- Render frontend static site: `guli-lingerie-web` — https://guli-lingerie-web.onrender.com
- Render API service: `guli-lingerie-api` — https://guli-lingerie-api.onrender.com
- Vercel project: `vite-react`
- Supabase project ref: `qttwufydrvdwmhxcpgjb`

These are discovered from connected account metadata. They do not prove that the video ads database migration or upload flow is ready.

## Required environment variables

Check the Render API service's environment settings without copying secret values into logs or chat.

- `SUPABASE_URL`
- One server-only service credential accepted by the existing backend: `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` (the runtime also currently accepts legacy aliases; prefer the documented server-only variable).
- Existing admin authentication variables as required by `backend/adminAuth.js`.

The frontend should use the existing public API base URL configuration. Do not add a Supabase service-role key or other privileged key to any `VITE_*` variable.

## Deployment sequence

1. Verify the exact reviewed commit and all CI checks.
2. In Supabase, inspect whether `video_ads`, `video_ad_events`, and the `video-ads` bucket exist.
3. If the original migration has not been applied, review and apply `supabase/migrations/20261028_video_ads.sql` first. Inspect its public read and Storage policies before applying.
4. Apply `supabase/migrations/20261028_video_ads_production_hardening.sql` only after the original schema exists.
5. Verify the migration and Storage bucket settings in Supabase. Do not infer success from a file existing in GitHub.
6. Deploy the reviewed commit to Render and verify the service is healthy.
7. Deploy the reviewed commit to Vercel and verify the deployed Git SHA.
8. Run the smoke tests in `docs/VIDEO_ADS_SMOKE_TEST.md`.
9. Do not enable customer-facing campaigns until the public API, upload, admin auth, event tracking, and rollback paths pass.

## Signed media upload

The admin UI requests a short-lived upload URL from `POST /api/admin/video-ads/upload-url`. The server must authenticate the admin, validate the MIME type and file size, and generate the signed URL with the server-side Supabase client. The browser uploads the binary directly to Storage, avoiding the 15 MB Express JSON parser limit.

The `video-ads` bucket must permit public reads only if public URLs are used for playback. Anonymous upload/write must remain disabled. The server's signed upload URL is short-lived and must not be logged.

## Rollback

- Disable the video ads campaign from the admin UI, or temporarily disable the feature if a kill switch exists.
- Roll back Render and Vercel to the previous known-good deployment if the release causes regressions.
- Do not drop `video_ads` or `video_ad_events` as a routine rollback; that destroys campaign history and analytics.
- Keep additive migration columns/indexes unless a reviewed database rollback is required.
- Verify product catalogue, banners, cart, checkout, Social Promo, and Telegram Mini App after rollback.
