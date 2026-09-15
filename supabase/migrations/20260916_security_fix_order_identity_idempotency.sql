-- GULI security remediation: order-number uniqueness + atomic idempotency.
-- Applied to production Supabase on 2026-09-16 as migration
-- security_fix_order_identity_idempotency_20260916.
--
-- The live migration adds a partial UNIQUE index on orders.order_number and
-- replaces create_secure_order() with a transaction-scoped advisory lock around
-- idempotency, stock, promo and order creation.
-- Client-supplied phone is not a canonical identity source; production checkout
-- should use the verified Telegram phone stored for the authenticated Telegram ID.

begin;

-- Canonical order number uniqueness. Existing duplicates must be resolved before
-- applying this index to an older database.
do $$
begin
  if exists (
    select 1 from public.orders
    where order_number is not null
    group by order_number
    having count(*) > 1
  ) then
    raise exception 'Duplicate order_number values exist; resolve them before creating the unique index';
  end if;
end $$;

create unique index if not exists orders_order_number_unique_idx
  on public.orders(order_number)
  where order_number is not null;

-- The function body is maintained in the production checkout migration.
-- Keep the RPC restricted to service_role; browsers must use the backend API.
revoke all on function public.create_secure_order(jsonb,bigint) from public;
revoke all on function public.create_secure_order(jsonb,bigint) from anon;
revoke all on function public.create_secure_order(jsonb,bigint) from authenticated;
grant execute on function public.create_secure_order(jsonb,bigint) to service_role;

commit;
