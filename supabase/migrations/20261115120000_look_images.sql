-- Reference pictures for stage 3: one picture per character (13) and per location (15), keyed by
-- the name as written. A redraw adds a new version and keeps the old one. The storyboard frames
-- use them as references, and M5's reference lock starts from them. Images are made on Kie.ai,
-- saved to the private "media" bucket under <workspace>/projects/<project>/look/, shown through
-- short-lived signed links. Written by the server; members read through RLS.

create table public.look_images (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('character', 'location')),
  key text not null check (char_length(key) between 1 and 200),
  version integer not null default 1 check (version > 0),
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  model text not null check (char_length(model) <= 80),
  prompt text not null check (char_length(prompt) <= 4000),
  task_id text check (char_length(task_id) <= 200),
  path text check (char_length(path) <= 500),
  cost_usd numeric(10, 4),
  error text check (char_length(error) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, kind, key, version)
);

create index look_images_project_idx on public.look_images (project_id, kind, key, version desc);
create index look_images_workspace_id_idx on public.look_images (workspace_id);
create index look_images_created_by_idx on public.look_images (created_by);

alter table public.look_images enable row level security;
revoke all on public.look_images from anon, authenticated;
grant select on public.look_images to authenticated;
create policy "Members read look pictures" on public.look_images for select to authenticated using ((select private.is_member(workspace_id)));
