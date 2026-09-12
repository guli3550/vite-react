-- Stores the Telegram message representing each order so later receipt/status
-- changes can edit the same message instead of sending a new one.
create table if not exists public.telegram_admin_bot_order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  chat_id bigint not null,
  message_id bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id, chat_id)
);

create index if not exists telegram_admin_bot_order_messages_order_idx
  on public.telegram_admin_bot_order_messages(order_id);

alter table public.telegram_admin_bot_order_messages enable row level security;
revoke all on public.telegram_admin_bot_order_messages from anon, authenticated;
