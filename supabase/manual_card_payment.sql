-- GULI: manual HUMO / UZCARD card-to-card payment + receipt verification
alter table public.orders
  add column if not exists payment_status text not null default 'pending',
  add column if not exists payment_receipt_path text,
  add column if not exists payment_receipt_uploaded_at timestamptz,
  add column if not exists payment_verified_at timestamptz;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending','receipt_uploaded','verified','rejected'));

create index if not exists orders_payment_status_idx on public.orders(payment_status);
create index if not exists orders_payment_receipt_idx on public.orders(payment_receipt_path) where payment_receipt_path is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 6291456, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 6291456, allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

-- Receipt files stay in a private bucket. The backend uses the Supabase service key
-- and gives the admin a short-lived signed URL only after admin authentication.
