-- Menab's own AI work (the daily development analysis) is recorded with no workspace, so its
-- cost shows in the owner dashboard and never in a client's credits. Row-level security keeps
-- these rows hidden from workspace members (their policies match on workspace membership).
alter table public.ai_jobs alter column workspace_id drop not null;
comment on column public.ai_jobs.workspace_id is 'Null for Menab''s own work (the daily development analysis). Workspace members never see those rows.';
