-- GULI PAYMENT RESERVATION HARDENING 2026-09-01
-- Adds exact-once stock/promo reservation lifecycle for manual-card orders.
-- Run after production_checkout_fix_20260901.sql and payment_security_hardening_20260901.sql.

begin;

alter table if exists public.orders
  add column if not exists stock_reserved boolean not null default false,
  add column if not exists promo_reserved boolean not null default false,
  add column if not exists reservation_released_at timestamptz;

create index if not exists orders_reservation_release_idx
  on public.orders (payment_status, reservation_released_at, created_at)
  where payment_status in ('pending','receipt_uploaded','rejected');

-- Only canonical manual-card orders created after this migration have known reservation
-- provenance. Cash/legacy orders are deliberately not marked as reserved here.
create or replace function public.guli_mark_new_order_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(trim(coalesce(new.payment,''))) = 'card_manual' then
    new.stock_reserved := true;
    new.promo_reserved := nullif(trim(coalesce(new.promo_code,'')),'') is not null;
    new.reservation_released_at := null;
  else
    new.stock_reserved := false;
    new.promo_reserved := false;
    new.reservation_released_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists guli_mark_new_order_reservation on public.orders;
create trigger guli_mark_new_order_reservation
before insert on public.orders
for each row execute function public.guli_mark_new_order_reservation();

-- Release a reservation exactly once. The order row is locked for the whole transaction,
-- so concurrent timeout/rejection calls cannot restore stock or promo usage twice.
create or replace function public.release_order_reservation(p_order_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o record;
  it jsonb;
  qty integer;
  product_id_key text;
  released_stock integer := 0;
  released_promo boolean := false;
  promo record;
  product_found boolean;
begin
  select * into o
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'Buyurtma topilmadi';
  end if;

  if o.payment_status not in ('rejected')
     and coalesce(o.status,'') <> 'To‘lov qilinmadi' then
    raise exception 'Faqat muddati tugagan yoki rad etilgan to‘lov rezervatsiyasi bo‘shatiladi';
  end if;

  if o.reservation_released_at is not null then
    return jsonb_build_object('released', false, 'already_released', true, 'order_id', o.id);
  end if;

  if coalesce(o.stock_reserved,false) is not true
     and coalesce(o.promo_reserved,false) is not true then
    update public.orders
       set reservation_released_at = now(), updated_at = now()
     where id = o.id;
    return jsonb_build_object('released', false, 'nothing_reserved', true, 'order_id', o.id);
  end if;

  if coalesce(o.payment_status,'pending') = 'verified' then
    raise exception 'Tasdiqlangan to‘lov rezervatsiyasini bo‘shatish mumkin emas';
  end if;

  if coalesce(o.stock_reserved,false) is true then
    for it in select value from jsonb_array_elements(coalesce(o.items,'[]'::jsonb)) loop
      qty := coalesce(nullif(it->>'quantity','')::integer, nullif(it->>'qty','')::integer, 1);
      product_id_key := nullif(trim(coalesce(it->>'product_id', it->'product'->>'id','')),'');
      if qty < 1 or product_id_key is null then
        raise exception 'Buyurtma mahsuloti noto‘g‘ri';
      end if;

      update public.products
         set stock = coalesce(stock,0) + qty,
             updated_at = now()
       where id::text = product_id_key;
      get diagnostics product_found = row_count > 0;
      if not product_found then
        raise exception 'Rezervatsiya mahsuloti topilmadi: %', product_id_key;
      end if;
      released_stock := released_stock + qty;
    end loop;
  end if;

  if coalesce(o.promo_reserved,false) is true
     and nullif(trim(coalesce(o.promo_code,'')),'') is not null then
    select * into promo
      from public.promo_codes
     where upper(code) = upper(trim(o.promo_code))
     for update;
    if not found then
      raise exception 'Rezervatsiya promo kodi topilmadi: %', o.promo_code;
    end if;
    update public.promo_codes
       set used_count = greatest(0, coalesce(used_count,0) - 1)
     where id = promo.id;
    released_promo := true;
  end if;

  update public.orders
     set stock_reserved = false,
         promo_reserved = false,
         reservation_released_at = now(),
         updated_at = now()
   where id = o.id;

  return jsonb_build_object(
    'released', true,
    'order_id', o.id,
    'stock_units', released_stock,
    'promo_released', released_promo
  );
end;
$$;

-- Re-reserve an order after a rejected receipt so the customer can submit a replacement
-- receipt without selling inventory that has already been released.
create or replace function public.rereserve_order_reservation(p_order_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o record;
  it jsonb;
  prod record;
  promo record;
  qty integer;
  product_id_key text;
  reserved_stock integer := 0;
  reserved_promo boolean := false;
begin
  select * into o
    from public.orders
   where id = p_order_id
   for update;

  if not found then raise exception 'Buyurtma topilmadi'; end if;
  if o.payment_status <> 'rejected' then
    raise exception 'Faqat rad etilgan to‘lovni qayta rezervatsiya qilish mumkin';
  end if;
  if coalesce(o.stock_reserved,false) is true and o.reservation_released_at is null then
    return jsonb_build_object('reserved', false, 'already_reserved', true, 'order_id', o.id);
  end if;

  for it in select value from jsonb_array_elements(coalesce(o.items,'[]'::jsonb)) loop
    qty := coalesce(nullif(it->>'quantity','')::integer, nullif(it->>'qty','')::integer, 1);
    product_id_key := nullif(trim(coalesce(it->>'product_id', it->'product'->>'id','')),'');
    if qty < 1 or product_id_key is null then raise exception 'Buyurtma mahsuloti noto‘g‘ri'; end if;
    select * into prod from public.products where id::text = product_id_key for update;
    if not found then raise exception 'Mahsulot topilmadi'; end if;
    if coalesce(prod.stock,0) < qty then
      raise exception '% uchun omborda yetarli qoldiq yo‘q', coalesce(prod.name,prod.title,'Mahsulot');
    end if;
    update public.products set stock = stock - qty, updated_at = now() where id::text = prod.id::text;
    reserved_stock := reserved_stock + qty;
  end loop;

  if nullif(trim(coalesce(o.promo_code,'')),'') is not null then
    select * into promo from public.promo_codes where upper(code)=upper(trim(o.promo_code)) for update;
    if not found or promo.active is not true then raise exception 'Promo kod topilmadi yoki faol emas'; end if;
    if promo.starts_at is not null and promo.starts_at > now() then raise exception 'Promo kod hali kuchga kirmagan'; end if;
    if promo.expires_at is not null and promo.expires_at < now() then raise exception 'Promo kod muddati tugagan'; end if;
    if promo.usage_limit is not null and coalesce(promo.used_count,0) >= promo.usage_limit then raise exception 'Promo koddan foydalanish limiti tugagan'; end if;
    update public.promo_codes set used_count = coalesce(used_count,0) + 1 where id = promo.id;
    reserved_promo := true;
  end if;

  update public.orders
     set stock_reserved = true,
         promo_reserved = reserved_promo,
         reservation_released_at = null,
         updated_at = now()
   where id = o.id;

  return jsonb_build_object('reserved', true, 'order_id', o.id, 'stock_units', reserved_stock, 'promo_reserved', reserved_promo);
end;
$$;

revoke all on function public.release_order_reservation(bigint) from public, anon, authenticated;
revoke all on function public.rereserve_order_reservation(bigint) from public, anon, authenticated;
grant execute on function public.release_order_reservation(bigint) to service_role;
grant execute on function public.rereserve_order_reservation(bigint) to service_role;

commit;

select 'GULI payment reservation hardening installed successfully' as result;
