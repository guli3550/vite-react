create table if not exists public.telegram_users (
  telegram_id bigint primary key,
  username text,
  first_name text,
  last_name text,
  telegram_phone text,
  updated_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists telegram_phone text;

create index if not exists idx_orders_telegram_phone
  on public.orders (telegram_phone);

alter table public.telegram_users enable row level security;
