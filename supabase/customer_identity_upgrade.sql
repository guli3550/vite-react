-- GULI Premium: customer identity / CRM upgrade
-- Safe to run more than once.

create table if not exists public.telegram_users (
  telegram_id bigint primary key,
  username text,
  first_name text,
  last_name text,
  telegram_phone text,
  profile_photos jsonb not null default '[]'::jsonb,
  profile_photo_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.telegram_users add column if not exists username text;
alter table public.telegram_users add column if not exists first_name text;
alter table public.telegram_users add column if not exists last_name text;
alter table public.telegram_users add column if not exists telegram_phone text;
alter table public.telegram_users add column if not exists profile_photos jsonb default '[]'::jsonb;
alter table public.telegram_users add column if not exists profile_photo_synced_at timestamptz;
alter table public.telegram_users add column if not exists updated_at timestamptz default now();
update public.telegram_users set profile_photos='[]'::jsonb where profile_photos is null;
update public.telegram_users set updated_at=now() where updated_at is null;

alter table if exists public.orders add column if not exists promo_code text;
alter table if exists public.orders add column if not exists promo_discount_type text;
alter table if exists public.orders add column if not exists promo_discount_value numeric(12,2);
create index if not exists idx_orders_promo_code on public.orders (promo_code);

alter table public.telegram_users enable row level security;

select 'GULI customer identity upgrade completed successfully' as result;
