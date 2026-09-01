-- GULI PRODUCTION PAYMENT SECURITY HARDENING 2026-09-01
-- Non-destructive. Run once in Supabase SQL Editor.
-- Adds DB-level invariants so API bugs cannot bypass payment rules.

begin;

-- The checkout RPC is SECURITY DEFINER and must never be callable by browser roles.
revoke all on function public.create_secure_order(jsonb,bigint) from public;
revoke all on function public.create_secure_order(jsonb,bigint) from anon;
revoke all on function public.create_secure_order(jsonb,bigint) from authenticated;
grant execute on function public.create_secure_order(jsonb,bigint) to service_role;

-- Canonicalize payment state at the database boundary.
create or replace function public.guli_payment_guard()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  old_status text := coalesce(old.payment_status,'pending');
  new_status text := coalesce(new.payment_status,'pending');
begin
  if tg_op = 'INSERT' then
    -- A new order can never start as verified/rejected or with a fake receipt.
    new.payment_status := 'pending';
    new.payment_verified_at := null;
    new.payment_receipt_uploaded_at := null;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.payment_status is null then
      new.payment_status := old_status;
    end if;

    -- Do not allow a verified payment without a receipt object.
    if new.payment_status = 'verified' and nullif(trim(coalesce(new.payment_receipt_path,'')),'') is null then
      raise exception 'To‘lovni tasdiqlash uchun chek talab qilinadi';
    end if;

    -- Enforce the state machine in the DB, not only in Express.
    if old_status = 'pending' and new.payment_status not in ('pending','receipt_uploaded','rejected') then
      raise exception 'Noto‘g‘ri payment state transition: % -> %', old_status, new.payment_status;
    elsif old_status = 'receipt_uploaded' and new.payment_status not in ('receipt_uploaded','verified','rejected') then
      raise exception 'Noto‘g‘ri payment state transition: % -> %', old_status, new.payment_status;
    elsif old_status = 'verified' and new.payment_status not in ('verified','rejected') then
      raise exception 'Tasdiqlangan to‘lovni qayta ochib bo‘lmaydi';
    elsif old_status = 'rejected' and new.payment_status not in ('rejected','receipt_uploaded') then
      raise exception 'Rad etilgan to‘lov faqat yangi chek bilan qayta tekshiriladi';
    end if;

    -- Rejected -> verified is never allowed directly. A replacement receipt must
    -- first move the order to receipt_uploaded, then an admin can verify it.
    if old_status = 'rejected' and new.payment_status = 'receipt_uploaded' and nullif(trim(coalesce(new.payment_receipt_path,'')),'') is null then
      raise exception 'receipt_uploaded holati uchun yangi chek talab qilinadi';
    end if;

    if new.payment_status = 'verified' then
      new.payment_verified_at := coalesce(new.payment_verified_at, now());
    elsif old_status = 'verified' and new.payment_status <> 'verified' then
      new.payment_verified_at := null;
    end if;

    if new.payment_status = 'receipt_uploaded' and nullif(trim(coalesce(new.payment_receipt_path,'')),'') is null then
      raise exception 'receipt_uploaded holati uchun receipt path talab qilinadi';
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guli_payment_guard on public.orders;
create trigger trg_guli_payment_guard
before insert or update of payment_status,payment_receipt_path,payment_verified_at,payment_receipt_uploaded_at
on public.orders
for each row execute function public.guli_payment_guard();

-- Receipt objects are private by design. Browser access must go through the
-- authenticated API which issues a short-lived signed URL.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('payment-receipts','payment-receipts',false,6291456,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=6291456,allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];

commit;

select 'GULI payment DB security hardening installed' as result;
