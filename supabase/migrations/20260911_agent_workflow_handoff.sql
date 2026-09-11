-- GULI agent workflow handoff: additive + reversible.
-- Rollback:
-- DROP INDEX IF EXISTS public.agent_tasks_workflow_step_idx;
-- ALTER TABLE public.agent_tasks DROP COLUMN IF EXISTS workflow_step;
-- ALTER TABLE public.agent_tasks DROP COLUMN IF EXISTS workflow_id;
-- DROP TABLE IF EXISTS public.agent_workflows;

create table if not exists public.agent_workflows (
  id uuid primary key default gen_random_uuid(),
  workflow_type text not null,
  status text not null default 'running',
  context jsonb not null default '{}'::jsonb,
  created_by text not null default 'admin',
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  result jsonb,
  error text,
  constraint agent_workflows_type_check check (workflow_type in ('order_payment_status')),
  constraint agent_workflows_status_check check (status in ('running','completed','failed','cancelled','paused'))
);

alter table public.agent_tasks add column if not exists workflow_id uuid references public.agent_workflows(id) on delete set null;
alter table public.agent_tasks add column if not exists workflow_step integer;
create index if not exists agent_tasks_workflow_step_idx on public.agent_tasks (workflow_id, workflow_step, created_at desc);

alter table public.agent_workflows enable row level security;
revoke all on table public.agent_workflows from anon, authenticated;
