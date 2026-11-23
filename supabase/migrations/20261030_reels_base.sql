-- Base Reels tables required by 20261031_reels_* migrations and backend/reelsRuntime.js.
CREATE TABLE IF NOT EXISTS public.reels (
  id text PRIMARY KEY,
  video_url text NOT NULL,
  poster_url text NOT NULL DEFAULT '',
  caption text NOT NULL DEFAULT '',
  music_title text,
  author jsonb NOT NULL DEFAULT '{"name":"Guli Market","username":"gulii.uz","avatar":"/guli-logo.png","verified":true}'::jsonb,
  product_id text,
  product_name text,
  product_price numeric,
  product_image text,
  promo_image_url text,
  promo_text text,
  promo_url text,
  status text NOT NULL DEFAULT 'draft',
  likes_count integer NOT NULL DEFAULT 0,
  display_likes_count integer NOT NULL DEFAULT 100,
  shares_count integer NOT NULL DEFAULT 0,
  views_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reel_comments (
  id text PRIMARY KEY,
  reel_id text NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  guest_key text,
  author_name text NOT NULL DEFAULT 'Mehmon',
  author_avatar text NOT NULL DEFAULT '',
  body text NOT NULL,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reel_likes (
  reel_id text NOT NULL REFERENCES public.reels(id) ON DELETE CASCADE,
  viewer_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (reel_id, viewer_key)
);

CREATE INDEX IF NOT EXISTS idx_reels_status_created
  ON public.reels (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reel_comments_reel_created
  ON public.reel_comments (reel_id, created_at DESC);
