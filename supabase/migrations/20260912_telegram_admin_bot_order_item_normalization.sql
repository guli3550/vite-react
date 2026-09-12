-- Keep purchased item fields available at the top level of each order item.
-- The admin Telegram bridge reads image/name/images directly from each item.
create or replace function public.normalize_order_items_for_notifications()
returns trigger
language plpgsql
as $$
declare
  item jsonb;
  product jsonb;
  out_items jsonb := '[]'::jsonb;
begin
  if new.items is null or jsonb_typeof(new.items) <> 'array' then
    return new;
  end if;

  for item in select value from jsonb_array_elements(new.items)
  loop
    product := case when jsonb_typeof(item->'product') = 'object' then item->'product' else '{}'::jsonb end;
    item := item || jsonb_build_object(
      'name', coalesce(item->>'name', product->>'name'),
      'image', coalesce(item->>'image', product->>'image'),
      'images', coalesce(item->'images', product->'images'),
      'price', coalesce(item->'price', product->'price'),
      'product_code', coalesce(item->>'product_code', product->>'product_code')
    );
    out_items := out_items || jsonb_build_array(item);
  end loop;

  new.items := out_items;
  return new;
end;
$$;

drop trigger if exists trg_normalize_order_items_for_notifications on public.orders;
create trigger trg_normalize_order_items_for_notifications
before insert or update of items on public.orders
for each row execute function public.normalize_order_items_for_notifications();
