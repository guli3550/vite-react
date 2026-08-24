-- GULI LINGERIE: repair migration for an existing Supabase database.
-- Run this ONCE if commerce_schema.sql reports that a column such as "active" does not exist.
-- It is safe to run more than once.

-- Existing projects may already have public.products. CREATE TABLE IF NOT EXISTS
-- does not add new columns, so we explicitly add every commerce column here.
alter table if exists public.products add column if not exists name text;
alter table if exists public.products add column if not exists category text;
alter table if exists public.products add column if not exists description text default '';
alter table if exists public.products add column if not exists price numeric(12,2) default 0;
alter table if exists public.products add column if not exists old_price numeric(12,2);
alter table if exists public.products add column if not exists image text default '';
alter table if exists public.products add column if not exists images jsonb default '[]'::jsonb;
alter table if exists public.products add column if not exists sizes jsonb default '[]'::jsonb;
alter table if exists public.products add column if not exists colors jsonb default '[]'::jsonb;
alter table if exists public.products add column if not exists rating numeric(3,2) default 0;
alter table if exists public.products add column if not exists reviews integer default 0;
alter table if exists public.products add column if not exists stock integer default 0;
alter table if exists public.products add column if not exists featured boolean default false;
alter table if exists public.products add column if not exists active boolean default true;
alter table if exists public.products add column if not exists sort_order integer default 0;
alter table if exists public.products add column if not exists created_at timestamptz default now();
alter table if exists public.products add column if not exists updated_at timestamptz default now();

-- Repair NULL values before making the catalog usable.
update public.products set description = '' where description is null;
update public.products set price = 0 where price is null;
update public.products set image = '' where image is null;
update public.products set images = '[]'::jsonb where images is null;
update public.products set sizes = '[]'::jsonb where sizes is null;
update public.products set colors = '[]'::jsonb where colors is null;
update public.products set rating = 0 where rating is null;
update public.products set reviews = 0 where reviews is null;
update public.products set stock = 0 where stock is null;
update public.products set featured = false where featured is null;
update public.products set active = true where active is null;
update public.products set sort_order = 0 where sort_order is null;
update public.products set created_at = now() where created_at is null;
update public.products set updated_at = now() where updated_at is null;

create index if not exists idx_products_active_category
  on public.products (active, category, sort_order);

create index if not exists idx_products_featured
  on public.products (featured, active);

alter table if exists public.products enable row level security;

drop policy if exists products_public_read on public.products;
create policy products_public_read
  on public.products
  for select
  using (active = true);

-- Existing orders table repair.
alter table if exists public.orders add column if not exists telegram_id bigint;
alter table if exists public.orders add column if not exists username text;
alter table if exists public.orders add column if not exists first_name text;
alter table if exists public.orders add column if not exists telegram_phone text;
alter table if exists public.orders add column if not exists items jsonb;
alter table if exists public.orders add column if not exists subtotal numeric(12,2) default 0;
alter table if exists public.orders add column if not exists delivery numeric(12,2) default 0;
alter table if exists public.orders add column if not exists discount numeric(12,2) default 0;
alter table if exists public.orders add column if not exists total numeric(12,2) default 0;
alter table if exists public.orders add column if not exists address jsonb;
alter table if exists public.orders add column if not exists payment text default 'cash';
alter table if exists public.orders add column if not exists status text default 'Qabul qilindi';
alter table if exists public.orders add column if not exists created_at timestamptz default now();
alter table if exists public.orders add column if not exists updated_at timestamptz default now();

create index if not exists idx_orders_telegram_id
  on public.orders (telegram_id);
create index if not exists idx_orders_status_created_at
  on public.orders (status, created_at desc);

select 'GULI schema repair completed successfully' as result;
