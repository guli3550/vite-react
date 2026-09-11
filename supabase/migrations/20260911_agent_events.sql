-- GULI internal Agent Core audit trail.
-- Append-only operational events; browser roles must not access this table directly.

create table if not exists public.agent_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.agent_tasks(id) on delete cascade,
  agent_id text not null,
  event_type text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  constraint agent_events_event_type_check check (char_length(event_type) between 1 and 100),
  constraint agent_events_message_length_check check (message is null or char_length(message) <= 4000)
);

create index if not exists agent_events_task_created_idx on public.agent_events (task_id, created_at desc);
create index if not exists agent_events_agent_created_idx on public.agent_events (agent_id, created_at desc);

alter table public.agent_events enable row level security;
revoke all on table public.agent_events from anon, authenticated;

-- Rollback:
-- drop index if exists public.agent_events_agent_created_idx;
-- drop index if exists public.agent_events_task_created_idx;
-- drop table if exists public.agent_events;
