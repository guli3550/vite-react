-- GULI PAYMENT TERMINAL STATE HARDENING 2026-09-02
-- Defense-in-depth: once payment is verified, it cannot be changed to rejected.
-- Run after payment_security_hardening_20260901.sql.

begin;

create or replace function public.guli_verified_payment_terminal_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.payment_status = 'verified'
     and new.payment_status <> 'verified' then
    raise exception 'Tasdiqlangan to‘lov terminal holat: rejected yoki boshqa holatga o‘tkazib bo‘lmaydi';
  end if;

  if tg_op = 'UPDATE'
     and old.payment_status = 'verified'
     and new.payment_verified_at is null then
    raise exception 'Tasdiqlangan to‘lovning verified_at qiymatini o‘chirish mumkin emas';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guli_verified_payment_terminal on public.orders;
create trigger trg_guli_verified_payment_terminal
before update of payment_status,payment_verified_at
on public.orders
for each row execute function public.guli_verified_payment_terminal_guard();

revoke all on function public.guli_verified_payment_terminal_guard() from public, anon, authenticated;
grant execute on function public.guli_verified_payment_terminal_guard() to service_role;

commit;

select 'GULI verified payment terminal guard installed successfully' as result;
