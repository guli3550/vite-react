-- Atomic auth-session claim boundary.
-- A session can be consumed exactly once under a row lock.
-- Only service_role may execute this function.

create or replace function public.claim_auth_session(
  p_session_id uuid,
  p_ticket_hash text default null,
  p_otp_hash text default null,
  p_mode text default 'exchange'
)
returns table (
  session_id uuid,
  phone_number text,
  telegram_id bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.auth_sessions%rowtype;
begin
  if p_mode not in ('exchange','otp') then
    raise exception using errcode='22023', message='Invalid auth claim mode';
  end if;

  select * into s
  from public.auth_sessions
  where session_id = p_session_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Auth session not found';
  end if;
  if s.expires_at <= now() then
    raise exception using errcode='P0001', message='Auth session expired';
  end if;
  if s.is_verified or s.otp_used or s.exchange_ticket_used then
    raise exception using errcode='P0003', message='Auth session already used';
  end if;
  if s.telegram_id is null or s.phone_number is null or s.otp_hash is null then
    raise exception using errcode='P0004', message='Verified Telegram identity not ready';
  end if;

  if p_mode = 'exchange' then
    if p_ticket_hash is null or s.exchange_ticket_hash is null or s.exchange_ticket_hash <> p_ticket_hash then
      raise exception using errcode='P0005', message='Exchange ticket invalid';
    end if;
  else
    if p_otp_hash is null or s.otp_hash <> p_otp_hash then
      update public.auth_sessions
         set otp_attempts = least(coalesce(otp_attempts,0) + 1, 2147483647)
       where session_id = s.session_id
         and otp_used = false
         and exchange_ticket_used = false;
      if coalesce(s.otp_attempts,0) + 1 >= 5 then
        raise exception using errcode='P0006', message='OTP attempt limit exceeded';
      end if;
      raise exception using errcode='P0007', message='OTP invalid';
    end if;
    if coalesce(s.otp_attempts,0) >= 5 then
      raise exception using errcode='P0006', message='OTP attempt limit exceeded';
    end if;
  end if;

  update public.auth_sessions
     set is_verified = true,
         otp_used = true,
         exchange_ticket_used = true,
         verified_at = now()
   where session_id = s.session_id
     and is_verified = false
     and otp_used = false
     and exchange_ticket_used = false;

  return query select s.session_id, s.phone_number, s.telegram_id;
end;
$$;

revoke all on function public.claim_auth_session(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_auth_session(uuid,text,text,text) to service_role;
