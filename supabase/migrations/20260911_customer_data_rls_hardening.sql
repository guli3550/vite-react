-- Customer-data RLS hardening.
-- Backend uses service_role, so removing public table policies does not affect
-- authenticated server operations. No customer UI path should query these
-- tables directly with the anon key.

begin;

alter table if exists public.chat_messages enable row level security;
alter table if exists public.saved_addresses enable row level security;

drop policy if exists "Allow internal backend to manage chat" on public.chat_messages;
drop policy if exists "Allow public insert saved addresses" on public.saved_addresses;

revoke all on table public.chat_messages from anon, authenticated;
revoke all on table public.saved_addresses from anon, authenticated;

commit;

-- Rollback (only if a future direct-client integration is intentionally added):
-- grant select, insert, update, delete on table public.chat_messages to anon, authenticated;
-- grant insert on table public.saved_addresses to anon;
-- recreate narrowly-scoped policies after an auth-bound design review.
