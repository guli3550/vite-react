-- GULI PRODUCTION CHECKOUT FIX 2026-09-01
-- Run this ONCE in Supabase SQL Editor.
-- Fixes:
--   1) UUID = bigint checkout failure on products.id
--   2) card payment order state / receipt columns
--   3) canonical server-side price/stock/delivery calculation
--   4) Telegram/browser card checkout compatibility
-- This migration is idempotent and does not delete existing orders/products.

begin;

alter table if exists public.orders
  add column if not exists phone text,
  add column if not exists telegram_phone text,
  add column if not exists username text,
  add column if not exists first_name text,
  add column if not exists items jsonb,
  add column if not exists subtotal numeric(12,2) default 0,
  add column if not exists delivery numeric(12,2) default 0,
  add column if not exists discount numeric(12,2) default 0,
  add column if not exists total numeric(12,2) default 0,
  add column if not exists address jsonb,
  add column if not exists payment text default 'cash',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists payment_receipt_path text,
  add column if not exists payment_receipt_uploaded_at timestamptz,
  add column if not exists payment_verified_at timestamptz,
  add column if not exists promo_code text,
  add column if not exists status text default 'Qabul qilindi',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists order_number text;

-- Old UUID overload can make PostgREST choose the wrong function on legacy DBs.
drop function if exists public.create_secure_order(jsonb, uuid);

create or replace function public.create_secure_order(
  p_order jsonb,
  p_telegram_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  it jsonb;
  prod record;
  promo record;
  existing jsonb;
  normalized jsonb := '[]'::jsonb;
  new_item jsonb;
  qty integer;
  subtotal numeric(12,2) := 0;
  delivery numeric(12,2) := 0;
  discount numeric(12,2) := 0;
  total numeric(12,2);
  promo_code_key text := upper(trim(coalesce(p_order->>'promo_code','')));
  order_no text := nullif(trim(p_order->>'order_number'),'');
  product_code_key text;
  product_id_key text;
  telegram_phone text;
  has_telegram_phone boolean := false;
  payment_key text := lower(trim(coalesce(p_order->>'payment','cash')));
begin
  if p_telegram_id is null then
    raise exception 'Telegram foydalanuvchisi aniqlanmadi';
  end if;

  if jsonb_typeof(p_order->'items') <> 'array'
     or jsonb_array_length(p_order->'items') = 0
     or jsonb_array_length(p_order->'items') > 100 then
    raise exception 'Buyurtma mahsulotlari noto‘g‘ri';
  end if;

  -- Idempotency: retrying the same order number must not consume stock twice.
  if order_no is not null then
    select to_jsonb(o) into existing
      from public.orders o
     where o.order_number = order_no
       and o.telegram_id::text = p_telegram_id::text
     limit 1;
    if existing is not null then
      return existing;
    end if;
  end if;

  select exists (
    select 1 from information_schema.columns
     where table_schema='public'
       and table_name='telegram_users'
       and column_name='telegram_phone'
  ) into has_telegram_phone;

  if has_telegram_phone and to_regclass('public.telegram_users') is not null then
    execute 'select tu.telegram_phone from public.telegram_users tu where tu.telegram_id::text = $1::text limit 1'
      into telegram_phone using p_telegram_id;
  end if;

  -- Never cast products.id to bigint. Compare UUID/bigint IDs as text.
  -- Prefer immutable product_code when the cart contains it.
  for it in select value from jsonb_array_elements(p_order->'items') loop
    qty := coalesce(nullif(it->>'quantity','')::integer, nullif(it->>'qty','')::integer, 1);
    if qty < 1 or qty > 99 then
      raise exception 'Mahsulot miqdori noto‘g‘ri';
    end if;

    product_code_key := nullif(trim(coalesce(
      it->'product'->>'product_code',
      it->>'product_code',
      ''
    )),'');
    product_id_key := nullif(trim(coalesce(
      it->'product'->>'id',
      it->>'product_id',
      ''
    )),'');

    if product_code_key is not null then
      select * into prod
        from public.products
       where product_code = product_code_key
       for update;
    elsif product_id_key is not null then
      select * into prod
        from public.products
       where id::text = product_id_key
       for update;
    else
      raise exception 'Mahsulot identifikatori topilmadi';
    end if;

    if not found then
      raise exception 'Mahsulot topilmadi';
    end if;
    if coalesce(prod.active,false) is not true then
      raise exception '% hozir sotuvda emas', coalesce(prod.name, prod.title, 'Mahsulot');
    end if;
    if coalesce(prod.stock,0) < qty then
      raise exception '% uchun omborda yetarli qoldiq yo‘q', coalesce(prod.name, prod.title, 'Mahsulot');
    end if;

    subtotal := subtotal + coalesce(prod.price,0) * qty;

    new_item := it || jsonb_build_object(
      'quantity', qty,
      'product_id', prod.id,
      'product_code', prod.product_code,
      'product', coalesce(it->'product','{}'::jsonb) || jsonb_build_object(
        'id', prod.id,
        'product_code', prod.product_code,
        'name', coalesce(prod.name, prod.title),
        'price', prod.price,
        'old_price', prod.old_price,
        'stock', prod.stock
      )
    );
    normalized := normalized || jsonb_build_array(new_item);

    update public.products
       set stock = stock - qty,
           updated_at = now()
     where id::text = prod.id::text;
  end loop;

  -- Authoritative delivery calculation. Do not trust client delivery/total.
  delivery := case when subtotal >= 300000 then 0 else 20000 end;

  if promo_code_key <> '' then
    select * into promo
      from public.promo_codes
     where upper(code) = promo_code_key
     for update;

    if not found or promo.active is not true then
      raise exception 'Promo kod topilmadi yoki faol emas';
    end if;
    if promo.starts_at is not null and promo.starts_at > now() then
      raise exception 'Promo kod hali kuchga kirmagan';
    end if;
    if promo.expires_at is not null and promo.expires_at < now() then
      raise exception 'Promo kod muddati tugagan';
    end if;
    if promo.usage_limit is not null and promo.used_count >= promo.usage_limit then
      raise exception 'Promo koddan foydalanish limiti tugagan';
    end if;
    if subtotal < promo.min_order_amount then
      raise exception 'Minimal buyurtma % so‘m', promo.min_order_amount;
    end if;

    if promo.discount_type = 'percent' then
      discount := least(subtotal, round(subtotal * promo.discount_value / 100));
    else
      discount := least(subtotal, greatest(0,promo.discount_value));
    end if;

    update public.promo_codes
       set used_count = used_count + 1
     where id = promo.id;
  end if;

  total := greatest(0, subtotal + delivery - discount);

  if order_no is null then
    loop
      order_no := 'GULI-' || lpad((floor(random()*900000)+100000)::integer::text,6,'0');
      exit when not exists (select 1 from public.orders where order_number = order_no);
    end loop;
  end if;

  -- Normalize all legacy/frontend card labels to the backend canonical value.
  if payment_key in ('card','card_manual','karta','karta orqali','karta (uzcard / humo)','uzcard','humo')
     or payment_key like '%card%'
     or payment_key like '%karta%'
  then
    payment_key := 'card_manual';
  else
    payment_key := 'cash';
  end if;

  insert into public.orders (
    order_number, telegram_id, username, first_name, phone, telegram_phone,
    items, subtotal, delivery, discount, total, address, payment, payment_status,
    promo_code, status, created_at, updated_at
  ) values (
    order_no,
    p_telegram_id,
    nullif(p_order->>'username',''),
    nullif(p_order->>'first_name',''),
    nullif(p_order->>'phone',''),
    telegram_phone,
    normalized,
    subtotal,
    delivery,
    discount,
    total,
    p_order->'address',
    payment_key,
    case when payment_key = 'card_manual' then 'pending' else 'pending' end,
    nullif(p_order->>'promo_code',''),
    coalesce(nullif(p_order->>'status',''),'Qabul qilindi'),
    coalesce(nullif(p_order->>'created_at','')::timestamptz,now()),
    now()
  ) returning to_jsonb(public.orders.*) into existing;

  return existing;
exception when unique_violation then
  select to_jsonb(o) into existing
    from public.orders o
   where o.order_number = order_no
     and o.telegram_id::text = p_telegram_id::text
   limit 1;
  if existing is not null then return existing; end if;
  raise;
end;
$$;

grant execute on function public.create_secure_order(jsonb,bigint) to service_role;

commit;

select 'GULI production checkout fix installed successfully' as result;