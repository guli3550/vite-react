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

-- 4. Seed official Guli Market social buttons
INSERT INTO public.social_promo_items 
    (title, platform, label, target_url, row_number, sort_order, is_active, open_in_new_tab)
VALUES
    -- Row 1: Primary Brand Socials
    ('Instagram Guli', 'instagram', 'Instagram · @guli_market', 'https://www.instagram.com/guli_market', 1, 10, true, true),
    ('Telegram Kanal', 'telegram', 'Telegram · Rasmiy kanal', 'https://t.me/guli_market', 1, 20, true, true),
    ('YouTube Guli', 'youtube', 'YouTube · Guli Market TV', 'https://www.youtube.com/@guli_market', 1, 30, true, true),
    ('Telegram Bot', 'telegram', 'Telegram · Buyurtma boti', 'https://t.me/guli_market_bot', 1, 40, true, true),

    -- Row 2: Customer Community & Lifestyle
    ('Instagram Obzor', 'instagram', 'Instagram · Yangi kolleksiya', 'https://www.instagram.com/guli_market', 2, 10, true, true),
    ('Telegram Hamjamiyat', 'telegram', 'Telegram · Mijozlar guruhi', 'https://t.me/guli_market_chat', 2, 20, true, true),
    ('YouTube Obzor', 'youtube', 'YouTube · Moda va stillar', 'https://www.youtube.com/@guli_market', 2, 30, true, true),
    ('Instagram Reels', 'instagram', 'Instagram · Eksklyuziv Reels', 'https://www.instagram.com/guli_market/reels', 2, 40, true, true),

    -- Row 3: Support, VIP & Exclusive Drops
    ('Telegram Aloqa', 'telegram', 'Telegram · 24/7 Qo‘llab-quvvatlash', 'https://t.me/guli_support', 3, 10, true, true),
    ('Instagram VIP', 'instagram', 'Instagram · Maxsus chegirmalar', 'https://www.instagram.com/guli_market', 3, 20, true, true),
    ('YouTube Shorts', 'youtube', 'YouTube · Mahsulot videolari', 'https://www.youtube.com/@guli_market/shorts', 3, 30, true, true),
    ('Telegram Yangiliklar', 'telegram', 'Telegram · Hafta yangiliklari', 'https://t.me/guli_news', 3, 40, true, true)
ON CONFLICT DO NOTHING;

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
