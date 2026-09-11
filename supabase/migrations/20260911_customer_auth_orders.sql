-- Customer identity bridge for web/APK authentication.
-- Telegram orders keep telegram_id; web/app auth uses auth_user_id.
alter table public.orders add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
create index if not exists orders_auth_user_id_created_at_idx on public.orders(auth_user_id, created_at desc) where auth_user_id is not null;

alter table public.orders enable row level security;

-- Browser/mobile clients never write orders directly; backend service_role owns checkout.
revoke all on table public.orders from anon, authenticated;

-- Rollback:
-- drop index if exists public.orders_auth_user_id_created_at_idx;
-- alter table public.orders drop column if exists auth_user_id;
