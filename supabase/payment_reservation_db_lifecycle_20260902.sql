-- GULI PAYMENT RESERVATION DB LIFECYCLE 2026-09-02
-- Canonical follow-up to payment_reservation_hardening_20260901.sql.
-- Moves release/re-reserve decisions into the database so they do not depend on
-- Express monkey-patching or whether a timeout/rejection route was reached.

begin;

do $$
begin
  if to_regclass('public.orders') is null then raise exception 'Reservation lifecycle requires public.orders'; end if;
  if to_regclass('public.products') is null then raise exception 'Reservation lifecycle requires public.products'; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.proname='release_order_reservation' and p.pronargs=1 and p.proargtypes[0]='uuid'::regtype) then
    raise exception 'Reservation lifecycle requires release_order_reservation(uuid)';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.proname='rereserve_order_reservation' and p.pronargs=1 and p.proargtypes[0]='uuid'::regtype) then
    raise exception 'Reservation lifecycle requires rereserve_order_reservation(uuid)';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='payment_status') then
    raise exception 'Reservation lifecycle requires orders.payment_status';
  end if;
end;
$$;

-- Release inventory exactly when an order enters the rejected/expired payment state.
-- The RPC itself is idempotent, so repeated status writes cannot double-restore.
create or replace function public.guli_release_rejected_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(old.payment_status,'') is distinct from 'rejected'
     and coalesce(new.payment_status,'') = 'rejected' then
    perform public.release_order_reservation(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists guli_release_rejected_reservation on public.orders;
create trigger guli_release_rejected_reservation
after update of payment_status on public.orders
for each row execute function public.guli_release_rejected_reservation();

-- A rejected order may submit a replacement receipt. Re-reserve BEFORE the
-- rejected -> receipt_uploaded state becomes visible, so insufficient stock
-- blocks the state transition rather than creating an unreserved paid order.
create or replace function public.guli_rereserve_rejected_receipt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(old.payment_status,'') = 'rejected'
     and coalesce(new.payment_status,'') = 'receipt_uploaded'
     and coalesce(old.reservation_released_at is not null, false) then
    perform public.rereserve_order_reservation(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists guli_rereserve_rejected_receipt on public.orders;
create trigger guli_rereserve_rejected_receipt
before update of payment_status on public.orders
for each row execute function public.guli_rereserve_rejected_receipt();

revoke all on function public.guli_release_rejected_reservation() from public, anon, authenticated;
revoke all on function public.guli_rereserve_rejected_receipt() from public, anon, authenticated;

after_commit;

commit;

select 'GULI payment reservation DB lifecycle installed successfully' as result;
