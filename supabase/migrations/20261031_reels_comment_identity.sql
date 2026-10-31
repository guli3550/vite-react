-- Reels comment identity: canonical customer UUID or stable anonymous guest key.
-- Existing comments remain visible and are preserved.
ALTER TABLE public.reel_comments
  ADD COLUMN IF NOT EXISTS author_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_key text;

CREATE INDEX IF NOT EXISTS idx_reel_comments_reel_created
  ON public.reel_comments (reel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reel_comments_author_user
  ON public.reel_comments (author_user_id)
  WHERE author_user_id IS NOT NULL;

COMMENT ON COLUMN public.reel_comments.author_user_id IS
  'Canonical public.users.id for authenticated GULI customers; never client supplied.';
COMMENT ON COLUMN public.reel_comments.guest_key IS
  'Stable browser guest identifier; contains no personal data.';
