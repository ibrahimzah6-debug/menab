-- Model choice: workspaces can set a default writing model, and each project remembers
-- the model picked on its steps (for example {"text": "claude-sonnet-5-5"}).
alter table public.model_settings drop constraint model_settings_task_check;
alter table public.model_settings add constraint model_settings_task_check check (task in ('text', 'image', 'video', 'voice'));
alter table public.projects add column models jsonb not null default '{}'::jsonb;
grant update (models) on public.projects to authenticated;
