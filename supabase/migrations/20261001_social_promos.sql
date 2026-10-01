-- ============================================================================
-- GULI MARKET: ANIMATED SOCIAL MEDIA PROMO BUTTONS SCHEMA & SEED
-- ============================================================================

-- 1. Table for individual social promo buttons
CREATE TABLE IF NOT EXISTS public.social_promo_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'telegram', 'youtube', 'custom')),
    label TEXT NOT NULL,
    target_url TEXT NOT NULL,
    logo_url TEXT,
    row_number INTEGER NOT NULL CHECK (row_number BETWEEN 1 AND 3),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    open_in_new_tab BOOLEAN NOT NULL DEFAULT true,
    mobile_visible BOOLEAN NOT NULL DEFAULT true,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_by UUID
);

-- Index for public queries
CREATE INDEX IF NOT EXISTS idx_social_promo_items_lookup 
ON public.social_promo_items (is_active, row_number, sort_order);

-- 2. Table for row marquee settings (speed, direction, enabled)
CREATE TABLE IF NOT EXISTS public.social_promo_settings (
    id SERIAL PRIMARY KEY,
    row_number INTEGER NOT NULL UNIQUE CHECK (row_number BETWEEN 1 AND 3),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    direction TEXT NOT NULL DEFAULT 'left' CHECK (direction IN ('left', 'right')),
    duration_seconds INTEGER NOT NULL DEFAULT 35 CHECK (duration_seconds BETWEEN 5 AND 180),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Row settings default rows
INSERT INTO public.social_promo_settings (row_number, is_enabled, direction, duration_seconds)
VALUES 
    (1, true, 'left', 34),
    (2, true, 'right', 42),
    (3, true, 'left', 36)
ON CONFLICT (row_number) DO NOTHING;

-- Promo items are intentionally not seeded with assumed handles or URLs.
-- Add official social destinations through the admin panel after verifying them.

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.social_promo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_promo_settings ENABLE ROW LEVEL SECURITY;

-- Public can read active promos
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'social_promo_items' AND policyname = 'Public read active social promos'
    ) THEN
        CREATE POLICY "Public read active social promos"
        ON public.social_promo_items
        FOR SELECT
        TO public
        USING (is_active = true AND (start_at IS NULL OR start_at <= now()) AND (end_at IS NULL OR end_at >= now()));
    END IF;
END $$;

-- Public can read row settings
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'social_promo_settings' AND policyname = 'Public read social promo settings'
    ) THEN
        CREATE POLICY "Public read social promo settings"
        ON public.social_promo_settings
        FOR SELECT
        TO public
        USING (true);
    END IF;
END $$;

-- Service role full access
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'social_promo_items' AND policyname = 'Service role full access on social promos'
    ) THEN
        CREATE POLICY "Service role full access on social promos"
        ON public.social_promo_items
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'social_promo_settings' AND policyname = 'Service role full access on social settings'
    ) THEN
        CREATE POLICY "Service role full access on social settings"
        ON public.social_promo_settings
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;
