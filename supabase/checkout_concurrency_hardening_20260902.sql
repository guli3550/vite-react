-- GULI CHECKOUT CONCURRENCY HARDENING 2026-09-02
-- Canonical follow-up to production_checkout_fix_20260901.sql.
-- Prevents same order_number from being created twice under concurrent retries.
-- Fail closed if legacy duplicate order numbers already exist.

begin;

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_secure_order'
      and pg_get_function_identity_arguments(p.oid) = 'jsonb, bigint'
  ) then
    raise exception 'Checkout concurrency migration requires canonical create_secure_order(jsonb,bigint)';
  end if;

  if exists (
    select 1
      from public.orders
     where order_number is not null
     group by order_number
    having count(*) > 1
  ) then
    raise exception 'Checkout concurrency migration blocked: duplicate order_number values exist';
  end if;
end;
$$;

-- The RPC already has an exception handler for unique_violation. This unique
-- invariant makes that handler safe under concurrent identical order retries:
-- one transaction wins, the other rolls back its stock/promo work and returns
-- the existing order instead of consuming inventory twice.
create unique index if not exists orders_order_number_unique_idx
  on public.orders (order_number)
  where order_number is not null;

-- Serialize identical checkout keys before the INSERT. The unique index remains
-- the authoritative invariant; this advisory lock reduces duplicate work and
-- makes the normal retry path deterministic without holding a permanent lock.
create or replace function public.guli_checkout_idempotency_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.order_number is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(
        'guli:checkout:' || coalesce(new.telegram_id::text, '') || ':' || new.order_number,
        0
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists aaa_guli_checkout_idempotency_lock on public.orders;
create trigger aaa_guli_checkout_idempotency_lock
before insert on public.orders
for each row execute function public.guli_checkout_idempotency_lock();

revoke all on function public.guli_checkout_idempotency_lock() from public, anon, authenticated;
grant execute on function public.guli_checkout_idempotency_lock() to service_role;

commit;

select 'GULI checkout concurrency hardening installed successfully' as result;
