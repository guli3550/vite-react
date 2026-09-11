-- GULI agent workflow concurrency guard: one task per workflow step.
-- Rollback: DROP INDEX IF EXISTS public.agent_tasks_workflow_step_unique_idx;
create unique index if not exists agent_tasks_workflow_step_unique_idx
on public.agent_tasks (workflow_id, workflow_step)
where workflow_id is not null and workflow_step is not null;
