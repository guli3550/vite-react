-- GULI Production Audit P0-01: payment timeout reservation release.
-- Run after the existing commerce schema/RPC is installed.

alter table if exists public.orders add column if not exists stock_reserved boolean not null default false;
alter table if exists public.orders add column if not exists promo_reserved boolean not null default false;
alter table if exists public.orders add column if not exists promo_code text;
alter table if exists public.orders add column if not exists reservation_released_at timestamptz;

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
  code text;
  released_items integer := 0;
  promo_released boolean := false;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Buyurtma topilmadi'; end if;
  if o.reservation_released_at is not null then
    return jsonb_build_object('released', false, 'reason', 'already_released');
  end if;
  if coalesce(o.stock_reserved, false) then
    for it in select value from jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) loop
      qty := coalesce((it->>'quantity')::integer, (it->>'qty')::integer, 0);
      if qty > 0 then
        if it->>'product_id' is not null then
          update public.products set stock = coalesce(stock, 0) + qty, updated_at = now() where id = (it->>'product_id')::bigint;
        elsif it->'product'->>'id' is not null then
          update public.products set stock = coalesce(stock, 0) + qty, updated_at = now() where id = (it->'product'->>'id')::bigint;
        elsif (it->'product'->>'product_code') ~ '^[0-9]{6}$' then
          update public.products set stock = coalesce(stock, 0) + qty, updated_at = now() where product_code = it->'product'->>'product_code';
        end if;
        released_items := released_items + 1;
      end if;
    end loop;
  end if;
  code := upper(trim(coalesce(o.promo_code, '')));
  if coalesce(o.promo_reserved, false) and code <> '' then
    update public.promo_codes set used_count = greatest(0, coalesce(used_count, 0) - 1) where upper(code) = code;
    promo_released := found;
  end if;
  update public.orders set stock_reserved = false, promo_reserved = false, reservation_released_at = now(), updated_at = now() where id = p_order_id;
  return jsonb_build_object('released', true, 'stock_items', released_items, 'promo_released', promo_released);
end;
$$;

grant execute on function public.release_order_reservation(bigint) to service_role;
