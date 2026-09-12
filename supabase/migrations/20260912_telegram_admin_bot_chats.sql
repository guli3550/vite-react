create table if not exists public.telegram_admin_bot_chats (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null unique,
  username text,
  first_name text,
  last_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists telegram_admin_bot_chats_active_idx on public.telegram_admin_bot_chats(active, updated_at desc);
alter table public.telegram_admin_bot_chats enable row level security;
revoke all on public.telegram_admin_bot_chats from anon, authenticated;
grant all on public.telegram_admin_bot_chats to service_role;
