-- Migration: telegram_admin_bot_events reliability & idempotent state machine
-- Adds status tracking, exponential backoff, error logging, and atomic locking.

alter table if exists public.telegram_admin_bot_events
  add column if not exists status text default 'pending',
  add column if not exists error text null,
  add column if not exists retry_count int default 0,
  add column if not exists next_attempt_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Create unique index on event_key if not exists
create unique index if not exists idx_telegram_admin_bot_events_event_key
  on public.telegram_admin_bot_events (event_key);

-- Create index for pending and retrying event lookups
create index if not exists idx_telegram_admin_bot_events_status_next
  on public.telegram_admin_bot_events (status, next_attempt_at)
  where status in ('pending', 'failed');

-- Atomic claim RPC with FOR UPDATE SKIP LOCKED to prevent concurrent duplicate delivery
create or replace function public.claim_telegram_admin_event(
  p_event_key text,
  p_event_type text,
  p_order_id text,
  p_max_retries int default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event record;
  v_now timestamptz := now();
begin
  -- Try to lock existing event row without waiting
  select * into v_event
  from public.telegram_admin_bot_events
  where event_key = p_event_key
  for update skip locked;

  if found then
    -- Already delivered
    if v_event.status = 'sent' then
      return jsonb_build_object('claimed', false, 'reason', 'already_sent');
    end if;

    -- Concurrently active in another worker (lock lease: 2 minutes)
    if v_event.status = 'processing' and v_event.updated_at > v_now - interval '2 minutes' then
      return jsonb_build_object('claimed', false, 'reason', 'currently_processing');
    end if;

    -- Bounded retries limit reached
    if coalesce(v_event.retry_count, 0) >= p_max_retries then
      return jsonb_build_object('claimed', false, 'reason', 'max_retries_exceeded');
    end if;

    -- Exponential backoff waiting period
    if v_event.next_attempt_at is not null and v_event.next_attempt_at > v_now then
      return jsonb_build_object('claimed', false, 'reason', 'backoff_waiting');
    end if;

    -- Claim this event for retry
    update public.telegram_admin_bot_events
    set status = 'processing',
        updated_at = v_now
    where id = v_event.id;

    return jsonb_build_object(
      'claimed', true,
      'event_id', v_event.id,
      'retry_count', coalesce(v_event.retry_count, 0)
    );
  end if;

  -- If not found, attempt atomic insert as processing
  begin
    insert into public.telegram_admin_bot_events(
      event_key, event_type, order_id, status, retry_count, next_attempt_at, updated_at
    ) values (
      p_event_key,
      p_event_type,
      case when p_order_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_order_id::uuid else null end,
      'processing',
      0,
      v_now,
      v_now
    )
    returning * into v_event;

    return jsonb_build_object(
      'claimed', true,
      'event_id', v_event.id,
      'retry_count', 0
    );
  exception when unique_violation then
    return jsonb_build_object('claimed', false, 'reason', 'concurrent_insert');
  end;
end;
$$;

revoke execute on function public.claim_telegram_admin_event(text, text, text, int) from public, anon, authenticated;
grant execute on function public.claim_telegram_admin_event(text, text, text, int) to service_role;
