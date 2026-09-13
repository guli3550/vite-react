create table if not exists public.payment_receipt_history (id uuid primary key default gen_random_uuid(), order_id uuid not null, receipt_path text not null, uploaded_at timestamptz not null default now(), unique(order_id, receipt_path));
create index if not exists payment_receipt_history_order_idx on public.payment_receipt_history(order_id, uploaded_at);
alter table public.payment_receipt_history enable row level security;
revoke all on public.payment_receipt_history from anon, authenticated;
create or replace function public.capture_payment_receipt_history() returns trigger language plpgsql security definer set search_path=public as $$ begin if nullif(trim(coalesce(new.payment_receipt_path,'')),'') is not null then insert into public.payment_receipt_history(order_id,receipt_path,uploaded_at) values(new.id,trim(new.payment_receipt_path),coalesce(new.payment_receipt_uploaded_at,now())) on conflict(order_id,receipt_path) do nothing; end if; return new; end; $$;
drop trigger if exists trg_capture_payment_receipt_history on public.orders;
create trigger trg_capture_payment_receipt_history after insert or update of payment_receipt_path,payment_receipt_uploaded_at on public.orders for each row execute function public.capture_payment_receipt_history();
insert into public.payment_receipt_history(order_id,receipt_path,uploaded_at) select id,payment_receipt_path,coalesce(payment_receipt_uploaded_at,updated_at,created_at,now()) from public.orders where nullif(trim(coalesce(payment_receipt_path,'')),'') is not null on conflict(order_id,receipt_path) do nothing;
