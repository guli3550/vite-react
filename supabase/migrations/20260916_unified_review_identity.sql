-- Canonical Telegram identity data used by product reviews.
-- Safe/idempotent: existing reviews remain intact.

alter table public.product_reviews
  add column if not exists photo_url text;

create index if not exists idx_product_reviews_telegram_created
  on public.product_reviews (telegram_id, created_at desc);

comment on column public.product_reviews.telegram_id is
  'Canonical Telegram user ID; same identity is used by Mini App and browser sessions.';
comment on column public.product_reviews.photo_url is
  'Telegram profile photo URL captured from validated identity data.';
