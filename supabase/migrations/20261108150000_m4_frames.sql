-- M4: storyboard frames (output 17). One row per drawn image; a redraw adds a new version and
-- keeps the old one. The current frame for a number is its highest version. Images are made on
-- Kie.ai, saved to the private "media" bucket under <workspace>/projects/<project>/frames/, and
-- shown through short-lived signed links. Written by the server; members read through RLS.

create table public.frame_images (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  n smallint not null check (n between 1 and 200),
  version integer not null default 1 check (version > 0),
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  style text not null check (style in ('sketch', 'photo')),
  aspect text not null check (char_length(aspect) <= 10),
  model text not null check (char_length(model) <= 80),
  prompt text not null check (char_length(prompt) <= 4000),
  task_id text check (char_length(task_id) <= 200),
  path text check (char_length(path) <= 500),
  cost_usd numeric(10, 4),
  error text check (char_length(error) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, n, version)
);

create index frame_images_project_idx on public.frame_images (project_id, n, version desc);
create index frame_images_workspace_id_idx on public.frame_images (workspace_id);
create index frame_images_created_by_idx on public.frame_images (created_by);

alter table public.frame_images enable row level security;
revoke all on public.frame_images from anon, authenticated;
grant select on public.frame_images to authenticated;
create policy "Members read frames" on public.frame_images for select to authenticated using ((select private.is_member(workspace_id)));
