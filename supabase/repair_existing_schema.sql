-- GULI LINGERIE: robust legacy commerce repair.
-- Safe to run again after a failed attempt.

alter table if exists public.products add column if not exists title text;
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
alter table if exists public.products add column if not exists product_code text;

update public.products
set title = coalesce(nullif(trim(title), ''), nullif(trim(name), ''))
where title is null or trim(title) = '';

-- Normalize legacy JSON-like columns to JSONB.
do $$
declare t text;
begin
  select data_type into t from information_schema.columns where table_schema='public' and table_name='products' and column_name='images';
  if t is null then
    alter table public.products add column images jsonb default '[]'::jsonb;
  elsif t <> 'jsonb' then
    alter table public.products add column if not exists images_jsonb jsonb default '[]'::jsonb;
    execute 'update public.products set images_jsonb = case when images is null then ''[]''::jsonb else to_jsonb(images) end';
    alter table public.products drop column images;
    alter table public.products rename column images_jsonb to images;
  end if;

  select data_type into t from information_schema.columns where table_schema='public' and table_name='products' and column_name='sizes';
  if t is null then
    alter table public.products add column sizes jsonb default '[]'::jsonb;
  elsif t <> 'jsonb' then
    alter table public.products add column if not exists sizes_jsonb jsonb default '[]'::jsonb;
    execute 'update public.products set sizes_jsonb = case when sizes is null then ''[]''::jsonb else to_jsonb(sizes) end';
    alter table public.products drop column sizes;
    alter table public.products rename column sizes_jsonb to sizes;
  end if;

  select data_type into t from information_schema.columns where table_schema='public' and table_name='products' and column_name='colors';
  if t is null then
    alter table public.products add column colors jsonb default '[]'::jsonb;
  elsif t <> 'jsonb' then
    alter table public.products add column if not exists colors_jsonb jsonb default '[]'::jsonb;
    execute 'update public.products set colors_jsonb = case when colors is null then ''[]''::jsonb else to_jsonb(colors) end';
    alter table public.products drop column colors;
    alter table public.products rename column colors_jsonb to colors;
  end if;
end $$;

update public.products set title = coalesce(nullif(trim(title), ''), nullif(trim(name), ''), '');
update public.products set name = coalesce(nullif(trim(name), ''), nullif(trim(title), ''), '');
update public.products set category = coalesce(nullif(trim(category), ''), 'Boshqa');
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

do $$
declare r record; next_code integer;
begin
  for r in select id from public.products where product_code is null or product_code !~ '^[0-9]{6}$' loop
    loop
      next_code := floor(random() * 900000 + 100000)::integer;
      exit when not exists (select 1 from public.products p where p.product_code = lpad(next_code::text, 6, '0'));
    end loop;
    update public.products set product_code = lpad(next_code::text, 6, '0') where id = r.id;
  end loop;
end $$;
create unique index if not exists idx_products_product_code_unique on public.products (product_code);

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
alter table if exists public.orders add column if not exists order_number text;

-- Promo schema was missing from the original legacy repair script; this is why
-- the admin Promo tab could fail while products/orders still worked.
create table if not exists public.promo_codes (
  id bigint generated by default as identity primary key,
  code text not null unique,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  min_order_amount numeric(12,2) not null default 0 check (min_order_amount >= 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.promo_codes add column if not exists starts_at timestamptz;
alter table public.promo_codes add column if not exists expires_at timestamptz;
alter table public.promo_codes add column if not exists usage_limit integer;
alter table public.promo_codes add column if not exists used_count integer default 0;
alter table public.promo_codes add column if not exists active boolean default true;
create unique index if not exists idx_promo_codes_code_unique on public.promo_codes (code);
create index if not exists idx_promo_codes_active on public.promo_codes (active, code);

create index if not exists idx_products_active_category on public.products (active, category, sort_order);
create index if not exists idx_products_featured on public.products (featured, active);
create index if not exists idx_orders_telegram_id on public.orders (telegram_id);
create index if not exists idx_orders_status_created_at on public.orders (status, created_at desc);
create index if not exists idx_orders_order_number on public.orders (order_number);

alter table if exists public.products enable row level security;
alter table if exists public.promo_codes enable row level security;
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using (active = true);

select 'GULI commerce schema repair completed successfully' as result;
