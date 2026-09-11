-- GULI internal Agent Core foundation.
-- Internal/admin-only orchestration state; no customer-facing autonomous replies.

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  command text not null,
  status text not null default 'queued',
  created_by text not null default 'admin',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  error text,
  constraint agent_tasks_status_check check (status in ('queued','running','completed','failed','cancelled')),
  constraint agent_tasks_command_length_check check (char_length(command) between 1 and 2000)
);

create index if not exists agent_tasks_agent_created_idx on public.agent_tasks (agent_id, created_at desc);
create index if not exists agent_tasks_status_created_idx on public.agent_tasks (status, created_at desc);

alter table public.agent_tasks enable row level security;

revoke all on table public.agent_tasks from anon, authenticated;

-- Backend uses the Supabase secret/service connection; browser clients must not access this table directly.
-- Rollback:
-- drop index if exists public.agent_tasks_status_created_idx;
-- drop index if exists public.agent_tasks_agent_created_idx;
-- drop table if exists public.agent_tasks;
