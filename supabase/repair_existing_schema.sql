-- GULI LINGERIE: safe legacy-database repair.
-- Does not assign JSONB values to legacy TEXT columns.
-- Keeps original text columns until replacement JSONB columns are populated.

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

do $$
begin
  -- images: migrate TEXT -> JSONB through a temporary column.
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='images' and data_type='text') then
    alter table public.products add column if not exists images_jsonb jsonb default '[]'::jsonb;
    update public.products
      set images_jsonb = case
        when images is null or btrim(images) = '' then '[]'::jsonb
        else jsonb_build_array(images)
      end;
    alter table public.products drop column images;
    alter table public.products rename column images_jsonb to images;
  elsif not exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='images') then
    alter table public.products add column images jsonb default '[]'::jsonb;
  end if;

  -- sizes: migrate TEXT -> JSONB through a temporary column.
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='sizes' and data_type='text') then
    alter table public.products add column if not exists sizes_jsonb jsonb default '[]'::jsonb;
    update public.products
      set sizes_jsonb = case
        when sizes is null or btrim(sizes) = '' then '[]'::jsonb
        else jsonb_build_array(sizes)
      end;
    alter table public.products drop column sizes;
    alter table public.products rename column sizes_jsonb to sizes;
  elsif not exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='sizes') then
    alter table public.products add column sizes jsonb default '[]'::jsonb;
  end if;

  -- colors: migrate TEXT -> JSONB through a temporary column.
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='colors' and data_type='text') then
    alter table public.products add column if not exists colors_jsonb jsonb default '[]'::jsonb;
    update public.products
      set colors_jsonb = case
        when colors is null or btrim(colors) = '' then '[]'::jsonb
        else jsonb_build_array(colors)
      end;
    alter table public.products drop column colors;
    alter table public.products rename column colors_jsonb to colors;
  elsif not exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='colors') then
    alter table public.products add column colors jsonb default '[]'::jsonb;
  end if;
end $$;

-- Null cleanup for scalar fields only.
update public.products set description = '' where description is null;
update public.products set price = 0 where price is null;
update public.products set image = '' where image is null;
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

-- Orders migration.
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
