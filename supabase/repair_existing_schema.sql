-- GULI LINGERIE: one-time repair for an existing Supabase database.
-- Fixes legacy TEXT catalog columns without losing existing image/size/color values.
-- Safe to run again if a previous attempt failed.

alter table if exists public.products add column if not exists name text;
alter table if exists public.products add column if not exists category text;
alter table if exists public.products add column if not exists description text default '';
alter table if exists public.products add column if not exists price numeric(12,2) default 0;
alter table if exists public.products add column if not exists old_price numeric(12,2);
alter table if exists public.products add column if not exists image text default '';
alter table if exists public.products add column if not exists rating numeric(3,2) default 0;
alter table if exists public.products add column if not exists reviews integer default 0;
alter table if exists public.products add column if not exists stock integer default 0;
alter table if exists public.products add column if not exists featured boolean default false;
alter table if exists public.products add column if not exists active boolean default true;
alter table if exists public.products add column if not exists sort_order integer default 0;
alter table if exists public.products add column if not exists created_at timestamptz default now();
alter table if exists public.products add column if not exists updated_at timestamptz default now();

-- Convert legacy TEXT columns by creating JSONB replacements first.
do $$
declare
  image_type text;
  size_type text;
  color_type text;
begin
  select data_type into image_type from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='images';
  select data_type into size_type from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='sizes';
  select data_type into color_type from information_schema.columns
    where table_schema='public' and table_name='products' and column_name='colors';

  if image_type = 'text' then
    alter table public.products add column images_jsonb jsonb default '[]'::jsonb;
    update public.products
      set images_jsonb = case
        when images is null or btrim(images) = '' then '[]'::jsonb
        when left(btrim(images), 1) = '[' then
          case when btrim(images)::jsonb is not null then btrim(images)::jsonb else jsonb_build_array(images) end
        else jsonb_build_array(images)
      end;
    alter table public.products drop column images;
    alter table public.products rename column images_jsonb to images;
  elsif image_type is null then
    alter table public.products add column images jsonb default '[]'::jsonb;
  end if;

  if size_type = 'text' then
    alter table public.products add column sizes_jsonb jsonb default '[]'::jsonb;
    update public.products
      set sizes_jsonb = case
        when sizes is null or btrim(sizes) = '' then '[]'::jsonb
        when left(btrim(sizes), 1) = '[' then btrim(sizes)::jsonb
        else jsonb_build_array(sizes)
      end;
    alter table public.products drop column sizes;
    alter table public.products rename column sizes_jsonb to sizes;
  elsif size_type is null then
    alter table public.products add column sizes jsonb default '[]'::jsonb;
  end if;

  if color_type = 'text' then
    alter table public.products add column colors_jsonb jsonb default '[]'::jsonb;
    update public.products
      set colors_jsonb = case
        when colors is null or btrim(colors) = '' then '[]'::jsonb
        when left(btrim(colors), 1) = '[' then btrim(colors)::jsonb
        else jsonb_build_array(colors)
      end;
    alter table public.products drop column colors;
    alter table public.products rename column colors_jsonb to colors;
  elsif color_type is null then
    alter table public.products add column colors jsonb default '[]'::jsonb;
  end if;
end $$;

-- Normalize NULLs after the legacy conversion.
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

create index if not exists idx_products_active_category on public.products (active, category, sort_order);
create index if not exists idx_products_featured on public.products (featured, active);

alter table if exists public.products enable row level security;
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using (active = true);

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

create index if not exists idx_orders_telegram_id on public.orders (telegram_id);
create index if not exists idx_orders_status_created_at on public.orders (status, created_at desc);

select 'GULI schema repair completed successfully' as result;
