-- GULI Production Audit P0-01/P0-09
-- Canonical checkout RPC: reserves inventory/promo usage and does not trust
-- client-supplied privileged status/payment state.

alter table if exists public.orders add column if not exists stock_reserved boolean not null default false;
alter table if exists public.orders add column if not exists promo_reserved boolean not null default false;
alter table if exists public.orders add column if not exists promo_code text;
alter table if exists public.orders add column if not exists reservation_released_at timestamptz;
alter table if exists public.orders add column if not exists payment_status text default 'pending';
alter table if exists public.orders add column if not exists payment_verified_at timestamptz;

create or replace function public.create_secure_order(p_order jsonb, p_telegram_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  it jsonb; prod record; qty integer; subtotal numeric(12,2):=0;
  delivery numeric(12,2):=greatest(0,coalesce((p_order->>'delivery')::numeric,0));
  discount numeric(12,2):=0; total numeric(12,2);
  promo record; promo_code text:=upper(trim(coalesce(p_order->>'promo_code','')));
  normalized jsonb:='[]'::jsonb; new_item jsonb;
  order_no text:=nullif(p_order->>'order_number',''); existing jsonb; telegram_phone text;
  payment_method text:=coalesce(nullif(p_order->>'payment',''),'cash'); has_promo boolean:=false;
begin
  if p_telegram_id is null then raise exception 'Telegram foydalanuvchisi aniqlanmadi'; end if;
  if jsonb_typeof(p_order->'items') <> 'array' or jsonb_array_length(p_order->'items')=0 or jsonb_array_length(p_order->'items')>100 then raise exception 'Buyurtma mahsulotlari noto‘g‘ri'; end if;
  if order_no is not null then
    select to_jsonb(o) into existing from orders o where o.order_number=order_no and o.telegram_id=p_telegram_id limit 1;
    if existing is not null then return existing; end if;
  end if;
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
    update promo_codes set used_count=used_count+1 where id=promo.id; has_promo:=true;
  end if;
  total:=greatest(0,subtotal+delivery-discount);
  if order_no is null then order_no:='GULI-'||lpad((floor(random()*900000)+100000)::int::text,6,'0'); end if;
  insert into orders(order_number,telegram_id,username,first_name,phone,telegram_phone,items,subtotal,delivery,discount,total,address,payment,status,created_at,updated_at,stock_reserved,promo_reserved,promo_code,payment_status)
  values(order_no,p_telegram_id,nullif(p_order->>'username',''),nullif(p_order->>'first_name',''),nullif(p_order->>'phone',''),telegram_phone,normalized,subtotal,delivery,discount,total,p_order->'address',payment_method,'Qabul qilindi',now(),now(),true,has_promo,nullif(promo_code,''),'pending')
  returning to_jsonb(orders.*) into existing;
  return existing;
exception when unique_violation then
  select to_jsonb(o) into existing from orders o where o.order_number=order_no and o.telegram_id=p_telegram_id limit 1;
  if existing is not null then return existing; end if;
  raise;
end; $$;

grant execute on function public.create_secure_order(jsonb,bigint) to service_role;

create or replace function public.release_order_reservation(p_order_id bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o record; it jsonb; qty integer; code text; released_items integer:=0; promo_released boolean:=false;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Buyurtma topilmadi'; end if;
  if o.reservation_released_at is not null then return jsonb_build_object('released',false,'reason','already_released'); end if;
  if coalesce(o.stock_reserved,false) then
    for it in select value from jsonb_array_elements(coalesce(o.items,'[]'::jsonb)) loop
      qty:=coalesce((it->>'quantity')::integer,(it->>'qty')::integer,0);
      if qty>0 then
        if it->>'product_id' is not null then update products set stock=coalesce(stock,0)+qty,updated_at=now() where id=(it->>'product_id')::bigint;
        elsif it->'product'->>'id' is not null then update products set stock=coalesce(stock,0)+qty,updated_at=now() where id=(it->'product'->>'id')::bigint;
        elsif (it->'product'->>'product_code') ~ '^[0-9]{6}$' then update products set stock=coalesce(stock,0)+qty,updated_at=now() where product_code=it->'product'->>'product_code'; end if;
        released_items:=released_items+1;
      end if;
    end loop;
  end if;
  code:=upper(trim(coalesce(o.promo_code,'')));
  if coalesce(o.promo_reserved,false) and code<>'' then update promo_codes set used_count=greatest(0,coalesce(used_count,0)-1) where upper(code)=code; promo_released:=found; end if;
  update orders set stock_reserved=false,promo_reserved=false,reservation_released_at=now(),updated_at=now() where id=p_order_id;
  return jsonb_build_object('released',true,'stock_items',released_items,'promo_released',promo_released);
end; $$;

grant execute on function public.release_order_reservation(bigint) to service_role;
