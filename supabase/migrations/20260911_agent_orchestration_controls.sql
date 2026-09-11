-- GULI internal Agent orchestration controls.
-- Adds a safe paused state and audit events for pause/resume.

alter table public.agent_tasks drop constraint if exists agent_tasks_status_check;
alter table public.agent_tasks add constraint agent_tasks_status_check check (status in ('queued','running','paused','completed','failed','cancelled'));

alter table public.agent_events drop constraint if exists agent_events_event_type_check;
alter table public.agent_events add constraint agent_events_event_type_check check (event_type in ('task_created','task_started','tool_called','task_completed','task_failed','task_cancelled','task_retried','task_paused','task_resumed','security_blocked'));

create index if not exists agent_tasks_status_created_idx on public.agent_tasks (status, created_at desc);

-- Rollback:
-- alter table public.agent_tasks drop constraint if exists agent_tasks_status_check;
-- alter table public.agent_tasks add constraint agent_tasks_status_check check (status in ('queued','running','completed','failed','cancelled'));
-- alter table public.agent_events drop constraint if exists agent_events_event_type_check;
-- alter table public.agent_events add constraint agent_events_event_type_check check (event_type in ('task_created','task_started','tool_called','task_completed','task_failed','task_cancelled','task_retried','security_blocked'));
