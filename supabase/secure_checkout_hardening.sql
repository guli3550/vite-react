-- GULI LINGERIE: secure checkout hardening.
-- Run this once in Supabase SQL Editor after commerce_schema.sql / repair_existing_schema.sql.
-- The API now calls create_secure_order(), so checkout cannot trust client price,
-- stock, discount, delivery, or promo usage values.

create or replace function public.create_secure_order(p_order jsonb, p_telegram_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  it jsonb;
  prod record;
  qty integer;
  subtotal numeric(12,2) := 0;
  delivery numeric(12,2) := 0;
  discount numeric(12,2) := 0;
  total numeric(12,2);
  promo record;
  promo_code text := upper(trim(coalesce(p_order->>'promo_code','')));
  normalized jsonb := '[]'::jsonb;
  new_item jsonb;
  order_no text := nullif(p_order->>'order_number','');
  existing jsonb;
  telegram_phone text;
begin
  if p_telegram_id is null then
    raise exception 'Telegram foydalanuvchisi aniqlanmadi';
  end if;

  if jsonb_typeof(p_order->'items') <> 'array'
     or jsonb_array_length(p_order->'items') = 0
     or jsonb_array_length(p_order->'items') > 100 then
    raise exception 'Buyurtma mahsulotlari noto‘g‘ri';
  end if;

  if order_no is not null then
    select to_jsonb(o) into existing
    from public.orders o
    where o.order_number = order_no
      and o.telegram_id = p_telegram_id
    limit 1;
    if existing is not null then
      return existing;
    end if;
  end if;

  select tu.telegram_phone into telegram_phone
  from public.telegram_users tu
  where tu.telegram_id = p_telegram_id
  limit 1;

  for it in select value from jsonb_array_elements(p_order->'items') loop
    qty := coalesce((it->>'quantity')::integer, (it->>'qty')::integer, 1);
    if qty < 1 or qty > 99 then
      raise exception 'Mahsulot miqdori noto‘g‘ri';
    end if;

    if it->'product'->>'id' is not null then
      select * into prod
      from public.products
      where id = (it->'product'->>'id')::bigint
      for update;
    elsif it->>'product_id' is not null then
      select * into prod
      from public.products
      where id = (it->>'product_id')::bigint
      for update;
    else
      select * into prod
      from public.products
      where product_code = coalesce(it->'product'->>'product_code', it->>'product_code')
      for update;
    end if;

    if not found then
      raise exception 'Mahsulot topilmadi';
    end if;
    if not prod.active then
      raise exception '% hozir sotuvda emas', coalesce(prod.name,'Mahsulot');
    end if;
    if prod.stock < qty then
      raise exception '% uchun omborda yetarli qoldiq yo‘q', coalesce(prod.name,'Mahsulot');
    end if;

    subtotal := subtotal + (prod.price * qty);
    new_item := it || jsonb_build_object(
      'quantity', qty,
      'product_id', prod.id,
      'product_code', prod.product_code,
      'product', coalesce(it->'product','{}'::jsonb) || jsonb_build_object(
        'id', prod.id,
        'product_code', prod.product_code,
        'name', prod.name,
        'price', prod.price,
        'old_price', prod.old_price,
        'stock', prod.stock
      )
    );
    normalized := normalized || jsonb_build_array(new_item);

    update public.products
    set stock = stock - qty, updated_at = now()
    where id = prod.id;
  end loop;

  -- Delivery is calculated from the authoritative server subtotal.
  -- Never trust a delivery value sent by the Mini App.
  delivery := case when subtotal >= 300000 then 0 else 20000 end;

  if promo_code <> '' then
    select * into promo
    from public.promo_codes
    where upper(code) = promo_code
    for update;

    if not found or not promo.active then
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
      discount := least(subtotal, greatest(0, promo.discount_value));
    end if;

    update public.promo_codes
    set used_count = used_count + 1
    where id = promo.id;
  end if;

  total := greatest(0, subtotal + delivery - discount);

  if order_no is null then
    loop
      order_no := 'GULI-' || lpad((floor(random()*900000)+100000)::int::text, 6, '0');
      exit when not exists (select 1 from public.orders where order_number = order_no);
    end loop;
  end if;

  insert into public.orders(
    order_number, telegram_id, username, first_name, phone, telegram_phone,
    items, subtotal, delivery, discount, total, address, payment, status,
    created_at, updated_at
  )
  values(
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
    coalesce(nullif(p_order->>'payment',''),'cash'),
    coalesce(nullif(p_order->>'status',''),'Qabul qilindi'),
    coalesce(nullif(p_order->>'created_at','')::timestamptz, now()),
    now()
  )
  returning to_jsonb(public.orders.*) into existing;

  return existing;
exception when unique_violation then
  select to_jsonb(o) into existing
  from public.orders o
  where o.order_number = order_no
    and o.telegram_id = p_telegram_id
  limit 1;
  if existing is not null then
    return existing;
  end if;
  raise;
end;
$$;

grant execute on function public.create_secure_order(jsonb,bigint) to service_role;

select 'GULI secure checkout hardening installed' as result;
