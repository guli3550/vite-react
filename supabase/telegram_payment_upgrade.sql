-- GULI Telegram + manual Humo/Uzcard payment upgrade.
-- Run once in Supabase SQL Editor. Safe to run repeatedly.

-- 1) Canonical Telegram identity type: Telegram IDs are numeric BIGINT.
do $$
declare t text;
begin
  if to_regclass('public.orders') is not null then
    select data_type into t from information_schema.columns
      where table_schema='public' and table_name='orders' and column_name='telegram_id';
    if t = 'uuid' then
      alter table public.orders rename column telegram_id to telegram_id_legacy_uuid;
      alter table public.orders add column telegram_id bigint;
    elsif t is null then
      alter table public.orders add column telegram_id bigint;
    end if;
  end if;

  if to_regclass('public.telegram_users') is not null then
    select data_type into t from information_schema.columns
      where table_schema='public' and table_name='telegram_users' and column_name='telegram_id';
    if t = 'uuid' then
      alter table public.telegram_users rename column telegram_id to telegram_id_legacy_uuid;
      alter table public.telegram_users add column telegram_id bigint;
    elsif t is null then
      alter table public.telegram_users add column telegram_id bigint;
    end if;
  end if;

  if to_regclass('public.saved_addresses') is not null then
    select data_type into t from information_schema.columns
      where table_schema='public' and table_name='saved_addresses' and column_name='telegram_id';
    if t = 'uuid' then
      alter table public.saved_addresses rename column telegram_id to telegram_id_legacy_uuid;
      alter table public.saved_addresses add column telegram_id bigint;
    elsif t is null then
      alter table public.saved_addresses add column telegram_id bigint;
    end if;
  end if;
end $$;

-- 2) Payment workflow fields.
alter table if exists public.orders add column if not exists payment_status text default 'pending';
alter table if exists public.orders add column if not exists payment_receipt_path text;
alter table if exists public.orders add column if not exists payment_receipt_uploaded_at timestamptz;
alter table if exists public.orders add column if not exists payment_verified_at timestamptz;
alter table if exists public.orders add column if not exists promo_code text;
alter table if exists public.orders add column if not exists promo_discount_type text;
alter table if exists public.orders add column if not exists promo_discount_value numeric(12,2);

-- 3) One Telegram message per order. Admin status changes edit this message.
alter table if exists public.orders add column if not exists telegram_status_message_id bigint;
create index if not exists idx_orders_telegram_status_message on public.orders (telegram_id, telegram_status_message_id);
create index if not exists idx_orders_payment_status on public.orders (payment_status, created_at desc);

-- 4) Ensure the private receipt bucket exists.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 6291456,
  array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false, file_size_limit=6291456,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];

-- 5) Remove the legacy UUID RPC overload if it exists, then create the canonical BIGINT version.
drop function if exists public.create_secure_order(jsonb, uuid);

drop function if exists public.create_secure_order(jsonb, bigint);
create function public.create_secure_order(p_order jsonb, p_telegram_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  it jsonb;
  prod record;
  qty integer;
  subtotal numeric(12,2):=0;
  delivery numeric(12,2):=greatest(0,coalesce((p_order->>'delivery')::numeric,0));
  discount numeric(12,2):=0;
  total numeric(12,2);
  promo record;
  promo_code text:=upper(trim(coalesce(p_order->>'promo_code','')));
  normalized jsonb:='[]'::jsonb;
  new_item jsonb;
  order_no text:=nullif(p_order->>'order_number','');
  existing jsonb;
  telegram_phone text;
  payment_value text:=coalesce(nullif(p_order->>'payment',''),'cash');
  payment_status_value text:=coalesce(nullif(p_order->>'payment_status',''),'pending');
begin
  if p_telegram_id is null then raise exception 'Telegram foydalanuvchisi aniqlanmadi'; end if;
  if jsonb_typeof(p_order->'items') <> 'array' or jsonb_array_length(p_order->'items')=0 or jsonb_array_length(p_order->'items')>100 then raise exception 'Buyurtma mahsulotlari noto‘g‘ri'; end if;

  if order_no is not null then
    select to_jsonb(o) into existing from orders o where o.order_number=order_no and o.telegram_id=p_telegram_id limit 1;
    if existing is not null then return existing; end if;
  end if;

  if to_regclass('public.telegram_users') is not null then
    select tu.telegram_phone into telegram_phone from telegram_users tu where tu.telegram_id=p_telegram_id limit 1;
  end if;

  for it in select value from jsonb_array_elements(p_order->'items') loop
    qty:=coalesce((it->>'quantity')::integer,(it->>'qty')::integer,1);
    if qty<1 or qty>99 then raise exception 'Mahsulot miqdori noto‘g‘ri'; end if;

    if it->'product'->>'id' is not null then
      select * into prod from products where id=(it->'product'->>'id')::bigint for update;
    elsif it->>'product_id' is not null then
      select * into prod from products where id=(it->>'product_id')::bigint for update;
    else
      select * into prod from products where product_code=coalesce(it->'product'->>'product_code',it->>'product_code') for update;
    end if;
    if not found then raise exception 'Mahsulot topilmadi'; end if;
    if not prod.active then raise exception '% hozir sotuvda emas',coalesce(prod.name,'Mahsulot'); end if;
    if prod.stock<qty then raise exception '% uchun omborda yetarli qoldiq yo‘q',coalesce(prod.name,'Mahsulot'); end if;

    subtotal:=subtotal+(prod.price*qty);
    new_item:=it||jsonb_build_object(
      'quantity',qty,
      'product_id',prod.id,
      'product_code',prod.product_code,
      'product',coalesce(it->'product','{}'::jsonb)||jsonb_build_object(
        'id',prod.id,'product_code',prod.product_code,'name',prod.name,
        'price',prod.price,'old_price',prod.old_price,'stock',prod.stock));
    normalized:=normalized||jsonb_build_array(new_item);
    update products set stock=stock-qty,updated_at=now() where id=prod.id;
  end loop;

  if promo_code<>'' and to_regclass('public.promo_codes') is not null then
    select * into promo from promo_codes where upper(code)=promo_code for update;
    if not found or not promo.active then raise exception 'Promo kod topilmadi yoki faol emas'; end if;
    if promo.starts_at is not null and promo.starts_at>now() then raise exception 'Promo kod hali kuchga kirmagan'; end if;
    if promo.expires_at is not null and promo.expires_at<now() then raise exception 'Promo kod muddati tugagan'; end if;
    if promo.usage_limit is not null and promo.used_count>=promo.usage_limit then raise exception 'Promo koddan foydalanish limiti tugagan'; end if;
    if subtotal<promo.min_order_amount then raise exception 'Minimal buyurtma % so‘m',promo.min_order_amount; end if;
    if promo.discount_type='percent' then discount:=least(subtotal,round(subtotal*promo.discount_value/100));
    else discount:=least(subtotal,greatest(0,promo.discount_value)); end if;
    update promo_codes set used_count=used_count+1 where id=promo.id;
  end if;

  total:=greatest(0,subtotal+delivery-discount);
  if order_no is null then order_no:='GULI-'||lpad((floor(random()*900000)+100000)::int::text,6,'0'); end if;

  insert into orders(order_number,telegram_id,username,first_name,phone,telegram_phone,items,subtotal,delivery,discount,total,address,payment,payment_status,status,promo_code,promo_discount_type,promo_discount_value,created_at,updated_at)
  values(order_no,p_telegram_id,nullif(p_order->>'username',''),nullif(p_order->>'first_name',''),nullif(p_order->>'phone',''),telegram_phone,normalized,subtotal,delivery,discount,total,p_order->'address',payment_value,payment_status_value,coalesce(nullif(p_order->>'status',''),'Qabul qilindi'),nullif(p_order->>'promo_code',''),nullif(p_order->>'promo_discount_type',''),nullif(p_order->>'promo_discount_value','')::numeric,coalesce(nullif(p_order->>'created_at','')::timestamptz,now()),now())
  returning to_jsonb(orders.*) into existing;

  return existing;
exception when unique_violation then
  select to_jsonb(o) into existing from orders o where o.order_number=order_no and o.telegram_id=p_telegram_id limit 1;
  if existing is not null then return existing; end if;
  raise;
end; $$;

grant execute on function public.create_secure_order(jsonb,bigint) to service_role;

select 'GULI Telegram + payment upgrade completed successfully' as result;