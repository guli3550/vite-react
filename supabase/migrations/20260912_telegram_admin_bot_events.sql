-- Durable idempotency for the dedicated GULI admin Telegram notification bot.
-- Prevents duplicate alerts when Render restarts or runs more than one process.
create table if not exists public.telegram_admin_bot_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null,
  order_id uuid null,
  created_at timestamptz not null default now()
);

create index if not exists telegram_admin_bot_events_order_id_idx
  on public.telegram_admin_bot_events(order_id);

alter table public.telegram_admin_bot_events enable row level security;
revoke all on public.telegram_admin_bot_events from anon, authenticated;
