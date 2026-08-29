-- Stores Telegram groups/channels where the bot has been added or promoted.
-- Run once in Supabase SQL Editor.
create table if not exists public.telegram_broadcast_chats (
  chat_id bigint primary key,
  chat_type text not null check (chat_type in ('group','supergroup','channel')),
  title text,
  username text,
  bot_status text not null default 'member',
  can_post_messages boolean not null default false,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists telegram_broadcast_chats_active_idx
  on public.telegram_broadcast_chats(active);

alter table public.telegram_broadcast_chats enable row level security;

-- Backend uses SUPABASE_SECRET_KEY, so no public policies are required.
