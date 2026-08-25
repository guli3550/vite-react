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

update public.products set title = coalesce(nullif(trim(title), ''), nullif(trim(name), '')) where title is null or trim(title) = '';

do $$
declare t text;
begin
  select data_type into t from information_schema.columns where table_schema='public' and table_name='products' and column_name='images';
  if t is null then alter table public.products add column images jsonb default '[]'::jsonb;
  elsif t <> 'jsonb' then alter table public.products add column if not exists images_jsonb jsonb default '[]'::jsonb; execute 'update public.products set images_jsonb = case when images is null then ''[]''::jsonb else to_jsonb(images) end'; alter table public.products drop column images; alter table public.products rename column images_jsonb to images; end if;
  select data_type into t from information_schema.columns where table_schema='public' and table_name='products' and column_name='sizes';
  if t is null then alter table public.products add column sizes jsonb default '[]'::jsonb;
  elsif t <> 'jsonb' then alter table public.products add column if not exists sizes_jsonb jsonb default '[]'::jsonb; execute 'update public.products set sizes_jsonb = case when sizes is null then ''[]''::jsonb else to_jsonb(sizes) end'; alter table public.products drop column sizes; alter table public.products rename column sizes_jsonb to sizes; end if;
  select data_type into t from information_schema.columns where table_schema='public' and table_name='products' and column_name='colors';
  if t is null then alter table public.products add column colors jsonb default '[]'::jsonb;
  elsif t <> 'jsonb' then alter table public.products add column if not exists colors_jsonb jsonb default '[]'::jsonb; execute 'update public.products set colors_jsonb = case when colors is null then ''[]''::jsonb else to_jsonb(colors) end'; alter table public.products drop column colors; alter table public.products rename column colors_jsonb to colors; end if;
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
    loop next_code := floor(random() * 900000 + 100000)::integer; exit when not exists (select 1 from public.products p where p.product_code = lpad(next_code::text, 6, '0')); end loop;
    update public.products set product_code = lpad(next_code::text, 6, '0') where id = r.id;
  end loop;
end $$;
create unique index if not exists idx_products_product_code_unique on public.products (product_code);

-- Legacy databases sometimes created Telegram IDs as uuid. The application uses
-- numeric Telegram IDs, so keep the legacy value separately and expose bigint.
do $$
declare t text;
begin
  select data_type into t from information_schema.columns where table_schema='public' and table_name='orders' and column_name='telegram_id';
  if t = 'uuid' then alter table public.orders rename column telegram_id to telegram_id_legacy_uuid; alter table public.orders add column telegram_id bigint;
  elsif t is null then alter table public.orders add column telegram_id bigint; end if;
  select data_type into t from information_schema.columns where table_schema='public' and table_name='telegram_users' and column_name='telegram_id';
  if t = 'uuid' then alter table public.telegram_users rename column telegram_id to telegram_id_legacy_uuid; alter table public.telegram_users add column telegram_id bigint;
  elsif t is null and to_regclass('public.telegram_users') is not null then alter table public.telegram_users add column telegram_id bigint; end if;
  select data_type into t from information_schema.columns where table_schema='public' and table_name='saved_addresses' and column_name='telegram_id';
  if t = 'uuid' then alter table public.saved_addresses rename column telegram_id to telegram_id_legacy_uuid; alter table public.saved_addresses add column telegram_id bigint;
  elsif t is null and to_regclass('public.saved_addresses') is not null then alter table public.saved_addresses add column telegram_id bigint; end if;
end $$;

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

create table if not exists public.promo_codes (id bigint generated by default as identity primary key, code text not null unique, discount_type text not null default 'percent', discount_value numeric(12,2) not null default 10, min_order_amount numeric(12,2) not null default 0, usage_limit integer, used_count integer not null default 0, starts_at timestamptz, expires_at timestamptz, active boolean not null default true, created_at timestamptz not null default now());
alter table if exists public.promo_codes add column if not exists code text;
alter table if exists public.promo_codes add column if not exists discount_type text default 'percent';
alter table if exists public.promo_codes add column if not exists discount_value numeric(12,2) default 10;
alter table if exists public.promo_codes add column if not exists min_order_amount numeric(12,2) default 0;
alter table if exists public.promo_codes add column if not exists usage_limit integer;
alter table if exists public.promo_codes add column if not exists used_count integer default 0;
alter table if exists public.promo_codes add column if not exists starts_at timestamptz;
alter table if exists public.promo_codes add column if not exists expires_at timestamptz;
alter table if exists public.promo_codes add column if not exists active boolean default true;
alter table if exists public.promo_codes add column if not exists created_at timestamptz default now();
update public.promo_codes set code = upper(trim(code)) where code is not null;
update public.promo_codes set discount_type = 'percent' where discount_type is null or discount_type not in ('percent','fixed');
update public.promo_codes set discount_value = 10 where discount_value is null or discount_value <= 0;
update public.promo_codes set min_order_amount = 0 where min_order_amount is null or min_order_amount < 0;
update public.promo_codes set used_count = 0 where used_count is null or used_count < 0;
update public.promo_codes set active = true where active is null;
update public.promo_codes set created_at = now() where created_at is null;
create unique index if not exists idx_promo_codes_code_unique on public.promo_codes (code);
create index if not exists idx_promo_codes_active on public.promo_codes (active, code);
create index if not exists idx_products_active_category on public.products (active, category, sort_order);
create index if not exists idx_products_featured on public.products (featured, active);
create index if not exists idx_orders_telegram_id on public.orders (telegram_id);
create index if not exists idx_orders_status_created_at on public.orders (status, created_at desc);
create index if not exists idx_orders_order_number on public.orders (order_number);

-- Recreate the checkout RPC with the canonical bigint signature. This is important
-- for PostgREST because legacy databases may still contain the old uuid overload.
create or replace function public.create_secure_order(p_order jsonb, p_telegram_id bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  it jsonb; prod record; qty integer; subtotal numeric(12,2):=0; delivery numeric(12,2):=greatest(0,coalesce((p_order->>'delivery')::numeric,0)); discount numeric(12,2):=0; total numeric(12,2);
  promo record; promo_code text:=upper(trim(coalesce(p_order->>'promo_code',''))); normalized jsonb:='[]'::jsonb; new_item jsonb; order_no text:=nullif(p_order->>'order_number',''); existing jsonb; telegram_phone text;
begin
  if p_telegram_id is null then raise exception 'Telegram foydalanuvchisi aniqlanmadi'; end if;
  if jsonb_typeof(p_order->'items') <> 'array' or jsonb_array_length(p_order->'items')=0 or jsonb_array_length(p_order->'items')>100 then raise exception 'Buyurtma mahsulotlari noto‘g‘ri'; end if;
  if order_no is not null then select to_jsonb(o) into existing from orders o where o.order_number=order_no and o.telegram_id=p_telegram_id limit 1; if existing is not null then return existing; end if; end if;
  if to_regclass('public.telegram_users') is not null then select tu.telegram_phone into telegram_phone from telegram_users tu where tu.telegram_id=p_telegram_id limit 1; end if;
  for it in select value from jsonb_array_elements(p_order->'items') loop
    qty:=coalesce((it->>'quantity')::integer,(it->>'qty')::integer,1); if qty<1 or qty>99 then raise exception 'Mahsulot miqdori noto‘g‘ri'; end if;
    if it->'product'->>'id' is not null then select * into prod from products where id=(it->'product'->>'id')::bigint for update;
    elsif it->>'product_id' is not null then select * into prod from products where id=(it->>'product_id')::bigint for update;
    else select * into prod from products where product_code=coalesce(it->'product'->>'product_code',it->>'product_code') for update; end if;
    if not found then raise exception 'Mahsulot topilmadi'; end if;
    if not prod.active then raise exception '% hozir sotuvda emas',coalesce(prod.name,'Mahsulot'); end if;
    if prod.stock<qty then raise exception '% uchun omborda yetarli qoldiq yo‘q',coalesce(prod.name,'Mahsulot'); end if;
    subtotal:=subtotal+(prod.price*qty);
    new_item:=it||jsonb_build_object('quantity',qty,'product_id',prod.id,'product_code',prod.product_code,'product',coalesce(it->'product','{}'::jsonb)||jsonb_build_object('id',prod.id,'product_code',prod.product_code,'name',prod.name,'price',prod.price,'old_price',prod.old_price,'stock',prod.stock));
    normalized:=normalized||jsonb_build_array(new_item);
    update products set stock=stock-qty,updated_at=now() where id=prod.id;
  end loop;
  if promo_code<>'' then
    select * into promo from promo_codes where upper(code)=promo_code for update;
    if not found or not promo.active then raise exception 'Promo kod topilmadi yoki faol emas'; end if;
    if promo.starts_at is not null and promo.starts_at>now() then raise exception 'Promo kod hali kuchga kirmagan'; end if;
    if promo.expires_at is not null and promo.expires_at<now() then raise exception 'Promo kod muddati tugagan'; end if;
    if promo.usage_limit is not null and promo.used_count>=promo.usage_limit then raise exception 'Promo koddan foydalanish limiti tugagan'; end if;
    if subtotal<promo.min_order_amount then raise exception 'Minimal buyurtma % so‘m',promo.min_order_amount; end if;
    if promo.discount_type='percent' then discount:=least(subtotal,round(subtotal*promo.discount_value/100)); else discount:=least(subtotal,greatest(0,promo.discount_value)); end if;
    update promo_codes set used_count=used_count+1 where id=promo.id;
  end if;
  total:=greatest(0,subtotal+delivery-discount);
  if order_no is null then order_no:='GULI-'||lpad((floor(random()*900000)+100000)::int::text,6,'0'); end if;
  insert into orders(order_number,telegram_id,username,first_name,phone,telegram_phone,items,subtotal,delivery,discount,total,address,payment,status,created_at,updated_at)
  values(order_no,p_telegram_id,nullif(p_order->>'username',''),nullif(p_order->>'first_name',''),nullif(p_order->>'phone',''),telegram_phone,normalized,subtotal,delivery,discount,total,p_order->'address',coalesce(nullif(p_order->>'payment',''),'cash'),coalesce(nullif(p_order->>'status',''),'Qabul qilindi'),coalesce(nullif(p_order->>'created_at','')::timestamptz,now()),now()) returning to_jsonb(orders.*) into existing;
  return existing;
exception when unique_violation then
  select to_jsonb(o) into existing from orders o where o.order_number=order_no and o.telegram_id=p_telegram_id limit 1; if existing is not null then return existing; end if; raise;
end; $$;
grant execute on function public.create_secure_order(jsonb,bigint) to service_role;

alter table if exists public.products enable row level security;
alter table if exists public.promo_codes enable row level security;
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using (active = true);

select 'GULI commerce schema repair completed successfully' as result;