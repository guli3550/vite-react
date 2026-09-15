-- GULI security remediation: harden SECURITY DEFINER helpers and function search_path.
-- Applied to the production Supabase project on 2026-09-16.

begin;

-- Runtime helper functions must resolve names through a fixed schema.
alter function public.normalize_order_items_for_notifications() set search_path = public;
alter function public.preserve_order_status_on_receipt_upload() set search_path = public;

-- Internal SECURITY DEFINER functions are not public RPC endpoints.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in (
      'capture_payment_receipt_history','guli_link_order_customer',
      'guli_mark_new_order_reservation','guli_payment_guard',
      'handle_new_auth_user','rls_auto_enable'
    ) and p.prosecdef
  loop
    execute format('revoke execute on function %s from public', r.sig);
    execute format('revoke execute on function %s from anon', r.sig);
    execute format('revoke execute on function %s from authenticated', r.sig);
  end loop;
end $$;

commit;
