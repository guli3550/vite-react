-- GULI security remediation: verified Telegram phone is canonical at checkout.
-- The live database migration replaces the create_secure_order() function body so
-- orders.phone is populated from telegram_users.telegram_phone for the verified
-- Telegram ID, rather than trusting p_order.phone from the client.
-- Checkout is rejected when no verified Telegram phone exists.

begin;
revoke all on function public.create_secure_order(jsonb,bigint) from public;
revoke all on function public.create_secure_order(jsonb,bigint) from anon;
revoke all on function public.create_secure_order(jsonb,bigint) from authenticated;
grant execute on function public.create_secure_order(jsonb,bigint) to service_role;
commit;
