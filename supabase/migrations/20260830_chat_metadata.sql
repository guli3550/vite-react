-- GULI production chat persistence upgrade
-- Run once in Supabase SQL Editor.

alter table if exists public.chat_messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table if exists public.chat_messages
  add column if not exists edited_at timestamptz null;

alter table if exists public.chat_messages
  add column if not exists deleted_at timestamptz null;

create index if not exists chat_messages_telegram_created_idx
  on public.chat_messages (telegram_id, created_at);

create index if not exists chat_messages_metadata_gin_idx
  on public.chat_messages using gin (metadata);
