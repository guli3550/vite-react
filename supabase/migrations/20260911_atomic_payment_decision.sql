-- GULI payment/order integrity: one atomic admin decision.
-- Applies payment_status and the corresponding order status in one DB transaction.
-- Production rollout must be reviewed before applying.

create or replace function public.admin_payment_decision(p_order_id uuid, p_payment_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_order_status text;
  v_now timestamptz := now();
begin
  if p_payment_status not in ('verified','rejected') then
    raise exception 'Admin payment decision must be verified or rejected';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Buyurtma topilmadi';
  end if;

  if coalesce(v_order.payment,'') <> 'card_manual' then
    raise exception 'Bu buyurtma manual karta to‘lovi emas';
  end if;

  if v_order.status = 'Yetkazildi' then
    raise exception 'Yetkazilgan buyurtmaning payment decision holatini o‘zgartirib bo‘lmaydi';
  end if;

  if p_payment_status = 'verified' and nullif(trim(coalesce(v_order.payment_receipt_path,'')),'') is null then
    raise exception 'To‘lovni tasdiqlash uchun chek talab qilinadi';
  end if;

  if coalesce(v_order.payment_status,'pending') = 'pending' and p_payment_status = 'verified' then
    raise exception 'Avval chek yuklangan bo‘lishi kerak';
  end if;

  if coalesce(v_order.payment_status,'pending') = 'verified' and p_payment_status = 'verified' then
    v_order_status := 'Qabul qilindi';
  elsif coalesce(v_order.payment_status,'pending') = 'rejected' and p_payment_status = 'verified' then
    raise exception 'Rad etilgan to‘lov yangi chek bilan qayta yuklanishi kerak';
  else
    v_order_status := case when p_payment_status = 'verified' then 'Qabul qilindi' else 'Bekor qilindi' end;
  end if;

  update public.orders
  set payment_status = p_payment_status,
      payment_verified_at = case when p_payment_status = 'verified' then coalesce(payment_verified_at, v_now) else null end,
      status = v_order_status,
      updated_at = v_now
  where id = p_order_id;

  select * into v_order from public.orders where id = p_order_id;
  return to_jsonb(v_order);
end;
$$;

revoke all on function public.admin_payment_decision(uuid,text) from public;
revoke all on function public.admin_payment_decision(uuid,text) from anon;
revoke all on function public.admin_payment_decision(uuid,text) from authenticated;
grant execute on function public.admin_payment_decision(uuid,text) to service_role;

-- Rollback:
-- revoke all on function public.admin_payment_decision(uuid,text) from service_role;
-- drop function if exists public.admin_payment_decision(uuid,text);
