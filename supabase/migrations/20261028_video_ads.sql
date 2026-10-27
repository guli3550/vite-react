-- ============================================================================
-- GULI MARKET: PROFESSIONAL VIDEO ADS SCHEMA & EVENT TRACKING
-- Migration: 20261028_video_ads.sql
-- Description: Creates video_ads and video_ad_events tables with RLS and indexes.
-- ============================================================================

-- 1. Create video_ads table
CREATE TABLE IF NOT EXISTS public.video_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    poster_url TEXT,
    cta_text TEXT NOT NULL DEFAULT 'Batafsil',
    destination_url TEXT,
    product_id TEXT,
    placement TEXT NOT NULL DEFAULT 'home' CHECK (placement IN ('home', 'product_feed', 'all')),
    platform TEXT NOT NULL DEFAULT 'all' CHECK (platform IN ('all', 'web', 'telegram')),
    priority INTEGER NOT NULL DEFAULT 0,
    frequency_cap INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT true,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_by TEXT
);

-- 2. Indexes for fast public and admin querying
CREATE INDEX IF NOT EXISTS idx_video_ads_public_lookup
ON public.video_ads (is_active, placement, platform, priority DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_ads_dates
ON public.video_ads (starts_at, ends_at);

-- 3. Create video_ad_events table for impressions, clicks and completions
CREATE TABLE IF NOT EXISTS public.video_ad_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id UUID NOT NULL REFERENCES public.video_ads(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click', 'video_start', 'video_complete')),
    session_id TEXT,
    platform TEXT NOT NULL DEFAULT 'web' CHECK (platform IN ('web', 'telegram')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Indexes for event analytics & deduplication
CREATE INDEX IF NOT EXISTS idx_video_ad_events_lookup
ON public.video_ad_events (ad_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_ad_events_session_dedup
ON public.video_ad_events (ad_id, event_type, session_id);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.video_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_ad_events ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies: Public read for active & non-expired video ads
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'video_ads' AND policyname = 'Public read active video ads'
    ) THEN
        CREATE POLICY "Public read active video ads"
        ON public.video_ads
        FOR SELECT
        TO public
        USING (
            is_active = true
            AND (starts_at IS NULL OR starts_at <= now())
            AND (ends_at IS NULL OR ends_at >= now())
        );
    END IF;
END $$;

-- 7. RLS Policies: Public insert for anonymous video ad events
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'video_ad_events' AND policyname = 'Public record video ad events'
    ) THEN
        CREATE POLICY "Public record video ad events"
        ON public.video_ad_events
        FOR INSERT
        TO public
        WITH CHECK (true);
    END IF;
END $$;

-- 8. Service role (Backend) full access policies
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'video_ads' AND policyname = 'Service role full access on video ads'
    ) THEN
        CREATE POLICY "Service role full access on video ads"
        ON public.video_ads
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'video_ad_events' AND policyname = 'Service role full access on video ad events'
    ) THEN
        CREATE POLICY "Service role full access on video ad events"
        ON public.video_ad_events
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- 9. Storage Bucket setup for video-ads (Run once in Supabase Storage if bucket doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('video-ads', 'video-ads', true)
ON CONFLICT (id) DO NOTHING;

-- Storage public read policy for video-ads
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Access for video-ads bucket'
    ) THEN
        CREATE POLICY "Public Access for video-ads bucket"
        ON storage.objects
        FOR SELECT
        TO public
        USING (bucket_id = 'video-ads');
    END IF;
END $$;
