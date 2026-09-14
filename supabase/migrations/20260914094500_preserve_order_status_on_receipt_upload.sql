-- Receipt upload must never regress the customer order fulfillment status.
-- The customer receipt endpoint historically wrote a temporary payment-waiting
-- status while saving the receipt. That could overwrite Qabul qilindi,
-- Tayyorlanmoqda, Yo‘lda, or Yetkazildi.
create or replace function public.preserve_order_status_on_receipt_upload()
returns trigger
language plpgsql
as $$
begin
  if new.payment_status = 'receipt_uploaded'
     and old.payment_receipt_path is distinct from new.payment_receipt_path then
    new.status := old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_preserve_order_status_on_receipt_upload on public.orders;

create trigger trg_preserve_order_status_on_receipt_upload
before update on public.orders
for each row
execute function public.preserve_order_status_on_receipt_upload();
