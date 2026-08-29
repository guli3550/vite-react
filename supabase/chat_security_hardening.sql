-- GULI chat security + realtime hardening.
-- Run once in Supabase SQL Editor.

alter table public.chat_messages enable row level security;

drop policy if exists "Allow internal backend to manage chat" on public.chat_messages;
drop policy if exists "Allow backend to manage chat" on public.chat_messages;

-- No anon/authenticated CRUD policy is intentionally created here.
-- The Render API uses SUPABASE_SECRET_KEY (service role), so it can manage chat
-- while browser clients cannot read/write another customer's conversation directly.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_messages'
  ) THEN
    EXECUTE 'alter publication supabase_realtime add table public.chat_messages';
  END IF;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'supabase_realtime publication is not available; enable Realtime for chat_messages in Supabase Dashboard.';
END $$;

create index if not exists idx_chat_messages_telegram_created
  on public.chat_messages (telegram_id, created_at);
