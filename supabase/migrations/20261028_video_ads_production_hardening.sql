-- Production hardening for Guli Market video ads.
-- Apply only after 20261028_video_ads.sql has been applied and verified.

ALTER TABLE public.video_ad_events
  ADD COLUMN IF NOT EXISTS event_id TEXT;

-- A nullable unique key preserves historical rows while making retry IDs idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_ad_events_event_id_unique
  ON public.video_ad_events (event_id);

-- Events must be written through the authenticated backend, not directly by anonymous clients.
DROP POLICY IF EXISTS "Public record video ad events" ON public.video_ad_events;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.video_ad_events FROM PUBLIC, anon, authenticated;

-- Signed uploads are issued by the server. Public read is retained for ad media playback;
-- this does not grant public upload permission.
UPDATE storage.buckets
SET file_size_limit = 52428800,
    allowed_mime_types = ARRAY[
      'video/mp4',
      'video/webm',
      'video/quicktime',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]
WHERE id = 'video-ads';
