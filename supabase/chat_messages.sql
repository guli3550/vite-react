-- Table for persistent chat messages between customers and admin
create table if not exists public.chat_messages (
    id uuid default gen_random_uuid() primary key,
    telegram_id bigint not null,
    sender text check (sender in ('customer', 'admin')),
    text text not null,
    created_at timestamptz default now()
);

-- Index for fast retrieval of message history for a specific user
create index if not exists idx_chat_messages_telegram_id on public.chat_messages (telegram_id);

-- Enable RLS
alter table public.chat_messages enable row level security;

-- Policies
create policy "Allow internal backend to manage chat" on public.chat_messages for all using (true) with check (true);
