# Guli Market Video Ads — Smoke Test Checklist

Record each item as PASS, FAIL, or NOT RUN with timestamp, environment, and commit SHA.

## API and security

- [ ] `GET /api/video-ads?placement=home&platform=web` returns only active, in-window ads.
- [ ] If Supabase is unavailable, the public endpoint does not return demo/sample ads.
- [ ] Unauthenticated `POST /api/admin/video-ads` is rejected.
- [ ] Unauthenticated `POST /api/admin/video-ads/upload-url` is rejected.
- [ ] Invalid MIME types and files over the allowed size are rejected.
- [ ] Anonymous direct insert into `video_ad_events` is denied by database permissions/RLS.
- [ ] Database errors are reported without fake success responses.

## Admin and media

- [ ] Authenticated admin can create an inactive test campaign.
- [ ] Admin can request a signed upload URL for an allowed test video.
- [ ] Browser uploads the binary directly to the signed URL.
- [ ] Returned public URL (if public bucket is configured) plays successfully.
- [ ] Poster upload and preview work.
- [ ] Edit, status toggle, and delete operate on persisted database rows.

## Analytics

- [ ] A visible impression is recorded after the visibility dwell threshold.
- [ ] Repeated impression requests for the same ad/session do not create duplicate rows.
- [ ] Clicks are recorded once per actual CTA interaction.
- [ ] KPI values are derived from database counts; in-memory counts are not added.
- [ ] CTR is clicks / impressions * 100, and is 0 when impressions are 0.

## Customer experience and regressions

- [ ] Home placement appears on gulii.uz.
- [ ] In-feed placement appears only in the intended catalogue feed.
- [ ] Web and Telegram platform filters work.
- [ ] CTA navigates to the correct internal or HTTPS destination.
- [ ] Video failure falls back to poster or hides the broken media gracefully.
- [ ] Banners, catalogue, cart, checkout, Social Promo, PWA and Telegram Mini App still work.
- [ ] Mobile layout has no horizontal overflow and the bottom navigation does not cover the ad.

## Cleanup

- [ ] Test campaign is deactivated or removed after testing.
- [ ] No secrets were printed in logs or committed.
- [ ] Production release decision is GO only if every mandatory test passed.
