-- M5: every file the Generate stage makes, in one table: digital actor sheets and outfit pictures
-- (34), keyframes (35), video clips (36), voice lines and the music track (37). One row per
-- attempt; a redo adds a new version and keeps the old one. The job is started on Kie.ai and its
-- task id saved at once, so a clip that takes longer than one request is still collected later.
-- Files go to the private "media" bucket under <workspace>/projects/<project>/generate/.
-- Written by the server; members read through RLS.

create table public.gen_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('sheet', 'outfit', 'keyframe', 'clip', 'voice', 'music')),
  key text not null check (char_length(key) between 1 and 200),
  version integer not null default 1 check (version > 0),
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  approved boolean not null default false,
  model text not null check (char_length(model) <= 80),
  prompt text not null check (char_length(prompt) <= 6000),
  params jsonb not null default '{}'::jsonb,
  task_id text check (char_length(task_id) <= 200),
  path text check (char_length(path) <= 500),
  seconds numeric(8, 2),
  cost_usd numeric(10, 4),
  error text check (char_length(error) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, kind, key, version)
);

create index gen_assets_project_idx on public.gen_assets (project_id, kind, key, version desc);
create index gen_assets_pending_idx on public.gen_assets (project_id) where status = 'generating';
create index gen_assets_workspace_id_idx on public.gen_assets (workspace_id);
create index gen_assets_created_by_idx on public.gen_assets (created_by);

alter table public.gen_assets enable row level security;
revoke all on public.gen_assets from anon, authenticated;
grant select on public.gen_assets to authenticated;
create policy "Members read generated media" on public.gen_assets for select to authenticated using ((select private.is_member(workspace_id)));
