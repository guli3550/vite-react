-- GULI AI Operations Center: orchestrator routing + pause/resume controls.
-- Safe/additive migration. Production deployment requires applying this migration first.

alter table public.agent_tasks
  drop constraint if exists agent_tasks_status_check;

alter table public.agent_tasks
  add constraint agent_tasks_status_check
  check (status in ('queued','running','completed','failed','cancelled','paused'));

create index if not exists agent_tasks_status_agent_idx
  on public.agent_tasks (status, agent_id, created_at desc);

-- Rollback:
-- 1) finish/cancel all paused tasks;
-- 2) drop agent_tasks_status_agent_idx;
-- 3) restore status check to queued/running/completed/failed/cancelled.
