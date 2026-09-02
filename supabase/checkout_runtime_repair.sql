-- GULI CHECKOUT RUNTIME REPAIR
-- Purpose: make the production checkout RPC safe on legacy databases where
-- products.id may be UUID or bigint, while the application uses bigint
-- Telegram IDs and six-digit product_code values.
--
-- Prerequisite: run supabase/repair_existing_schema.sql first.
-- This migration is idempotent. It does not delete orders/products or reset stock.
-- Run once in the Supabase SQL Editor, then verify the final SELECT result.

begin;

-- Ensure the columns used by the checkout RPC exist even when the legacy
-- orders table predates the commerce schema repair.
alter table if exists public.orders add column if not exists phone text;
alter table if exists public.orders add column if not exists telegram_phone text;
alter table if exists public.orders add column if not exists username text;
alter table if exists public.orders add column if not exists first_name text;
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
alter table if exists public.promo_codes add column if not exists max_discount_amount numeric(12,2);

-- Remove the legacy UUID overload when it exists. Keeping both UUID and bigint
-- signatures can make PostgREST resolve the wrong RPC on old databases.
drop function if exists public.create_secure_order(jsonb, uuid);

-- Canonical production checkout RPC.
-- IMPORTANT: products.id is never cast to bigint. It is compared as text so
-- UUID and bigint product primary keys are both supported.
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
  delivery numeric(12,2) := greatest(0, coalesce((p_order->>'delivery')::numeric, 0));
  discount numeric(12,2) := 0;
  total numeric(12,2);

  promo_code text := upper(trim(coalesce(p_order->>'promo_code', '')));
  order_no text := nullif(trim(p_order->>'order_number'), '');
  product_code_key text;
  product_id_key text;
  telegram_phone text;
  has_telegram_phone boolean := false;
begin
  if p_telegram_id is null then
    raise exception 'Telegram foydalanuvchisi aniqlanmadi';
  end if;

  if jsonb_typeof(p_order->'items') <> 'array'
     or jsonb_array_length(p_order->'items') = 0
     or jsonb_array_length(p_order->'items') > 100 then
    raise exception 'Buyurtma mahsulotlari noto‘g‘ri';
  end if;

  -- Idempotency: a retry with the same order number for the same Telegram
  -- user returns the existing order instead of consuming stock twice.
  if order_no is not null then
    select to_jsonb(o)
      into existing
      from public.orders o
     where o.order_number = order_no
       and o.telegram_id::text = p_telegram_id::text
     limit 1;

    if existing is not null then
      return existing;
    end if;
  end if;

  -- Some legacy telegram_users tables do not have telegram_phone. Check the
  -- column dynamically so the RPC remains executable on those installations.
  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'telegram_users'
       and column_name = 'telegram_phone'
  )
    into has_telegram_phone;

  if has_telegram_phone and to_regclass('public.telegram_users') is not null then
    execute 'select tu.telegram_phone from public.telegram_users tu where tu.telegram_id::text = $1::text limit 1'
       into telegram_phone
       using p_telegram_id;
  end if;

  -- Validate every line against the database. Never trust client price/name/stock.
  for it in
    select value
      from jsonb_array_elements(p_order->'items')
  loop
    qty := coalesce(
      nullif(it->>'quantity', '')::integer,
      nullif(it->>'qty', '')::integer,
      1
    );

    if qty < 1 or qty > 99 then
      raise exception 'Mahsulot miqdori noto‘g‘ri';
    end if;

    product_code_key := nullif(
      trim(coalesce(it->'product'->>'product_code', it->>'product_code', '')),
      ''
    );
    product_id_key := nullif(
      trim(coalesce(it->'product'->>'id', it->>'product_id', '')),
      ''
    );

    -- Prefer immutable six-digit product_code. If it was not supplied, use
    -- id::text so UUID and bigint legacy product IDs are both supported.
    if product_code_key is not null then
      select *
        into prod
        from public.products
       where product_code = product_code_key
       for update;
    elsif product_id_key is not null then
      select *
        into prod
        from public.products
       where id::text = product_id_key
       for update;
    else
      raise exception 'Mahsulot identifikatori topilmadi';
    end if;

    if not found then
      raise exception 'Mahsulot topilmadi';
    end if;

    if coalesce(prod.active, false) is not true then
      raise exception '% hozir sotuvda emas', coalesce(prod.name, prod.title, 'Mahsulot');
    end if;

    if coalesce(prod.stock, 0) < qty then
      raise exception '% uchun omborda yetarli qoldiq yo‘q', coalesce(prod.name, prod.title, 'Mahsulot');
    end if;

    subtotal := subtotal + (coalesce(prod.price, 0) * qty);

    new_item := it || jsonb_build_object(
      'quantity', qty,
      'product_id', prod.id,
      'product_code', prod.product_code,
      'product', coalesce(it->'product', '{}'::jsonb) || jsonb_build_object(
        'id', prod.id,
        'product_code', prod.product_code,
        'name', coalesce(prod.name, prod.title),
        'price', prod.price,
        'old_price', prod.old_price,
        'stock', prod.stock
      )
    );

    normalized := normalized || jsonb_build_array(new_item);

    -- id::text keeps this compatible with UUID and bigint product IDs.
    update public.products
       set stock = stock - qty,
           updated_at = now()
     where id::text = prod.id::text;
  end loop;

  -- Validate and consume a promo code inside the same transaction. If any
  -- later operation fails, PostgreSQL rolls the stock/promo changes back.
  if promo_code <> '' then
    select *
      into promo
      from public.promo_codes
     where upper(code) = promo_code
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
      if promo.max_discount_amount is not null and promo.max_discount_amount > 0 then
        discount := least(discount, promo.max_discount_amount);
      end if;
    else
      discount := least(subtotal, greatest(0, promo.discount_value));
    end if;

    update public.promo_codes
       set used_count = used_count + 1
     where id = promo.id;
  end if;

  total := greatest(0, subtotal + delivery - discount);

  if order_no is null then
    order_no := 'GULI-' || lpad(
      (floor(random() * 900000) + 100000)::integer::text,
      6,
      '0'
    );
  end if;

  insert into public.orders (
    order_number,
    telegram_id,
    username,
    first_name,
    phone,
    telegram_phone,
    items,
    subtotal,
    delivery,
    discount,
    total,
    address,
    payment,
    status,
    created_at,
    updated_at
  )
  values (
    order_no,
    p_telegram_id,
    nullif(p_order->>'username', ''),
    nullif(p_order->>'first_name', ''),
    nullif(p_order->>'phone', ''),
    telegram_phone,
    normalized,
    subtotal,
    delivery,
    discount,
    total,
    p_order->'address',
    coalesce(nullif(p_order->>'payment', ''), 'cash'),
    coalesce(nullif(p_order->>'status', ''), 'Qabul qilindi'),
    coalesce(nullif(p_order->>'created_at', '')::timestamptz, now()),
    now()
  )
  returning to_jsonb(public.orders.*)
  into existing;

  return existing;

exception
  when unique_violation then
    -- A retry may collide on order_number. Return the already-created order
    -- when it belongs to this Telegram user; otherwise preserve the error.
    select to_jsonb(o)
      into existing
      from public.orders o
     where o.order_number = order_no
       and o.telegram_id::text = p_telegram_id::text
     limit 1;

    if existing is not null then
      return existing;
    end if;

    raise;
end;
$$;

grant execute on function public.create_secure_order(jsonb, bigint) to service_role;

commit;

select 'GULI checkout runtime repair completed successfully' as result;
