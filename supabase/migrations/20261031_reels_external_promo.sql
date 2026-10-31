-- Optional external promotional CTA for Reels, independent from inventory products.
ALTER TABLE public.reels
  ADD COLUMN IF NOT EXISTS promo_image_url text,
  ADD COLUMN IF NOT EXISTS promo_text text,
  ADD COLUMN IF NOT EXISTS promo_url text;

COMMENT ON COLUMN public.reels.promo_image_url IS 'Optional image for external promo CTA shown instead of linked inventory product.';
COMMENT ON COLUMN public.reels.promo_text IS 'Optional label/text for external promo CTA.';
COMMENT ON COLUMN public.reels.promo_url IS 'Optional external destination URL for promo CTA.';
