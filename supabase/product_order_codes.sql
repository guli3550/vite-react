-- GULI: 6-digit product codes and reliable order codes.
-- Run this once in Supabase SQL Editor.
alter table public.products add column if not exists product_code text;

-- Existing products get unique six-digit codes.
do $$
declare
  r record;
  next_code integer;
begin
  for r in select id from public.products where product_code is null or product_code !~ '^[0-9]{6}$' loop
    loop
      next_code := floor(random() * 900000 + 100000)::integer;
      exit when not exists (select 1 from public.products p where p.product_code = lpad(next_code::text, 6, '0'));
    end loop;
    update public.products set product_code = lpad(next_code::text, 6, '0') where id = r.id;
  end loop;
end $$;

create unique index if not exists idx_products_product_code_unique on public.products(product_code);

-- Keep order_number six digits where possible; existing values are preserved.
alter table public.orders add column if not exists order_number text;
create index if not exists idx_orders_order_number on public.orders(order_number);
