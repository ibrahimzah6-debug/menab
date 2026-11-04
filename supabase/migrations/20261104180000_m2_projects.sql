-- M2: projects and the approval chain (stages, outputs, versions), the brief chat,
-- the AI job log and per-workspace model defaults. Every row carries workspace_id and RLS.

create function private.member_role(ws uuid)
returns public.member_role
language sql stable security definer set search_path = ''
as $$
  select m.role from public.members m
  where m.workspace_id = ws and m.user_id = (select auth.uid())
  limit 1;
$$;
revoke all on function private.member_role(uuid) from public;
grant execute on function private.member_role(uuid) to authenticated;

-- Admin, Producer and Coordinator edit and generate. Viewers only read.
create function private.can_edit(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.member_role(ws) in ('admin', 'producer', 'coordinator'), false);
$$;
revoke all on function private.can_edit(uuid) from public;
grant execute on function private.can_edit(uuid) to authenticated;

-- Admin and Producer create projects.
create function private.can_create_project(ws uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.member_role(ws) in ('admin', 'producer'), false);
$$;
revoke all on function private.can_create_project(uuid) from public;
grant execute on function private.can_create_project(uuid) to authenticated;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  client text check (char_length(client) <= 160),
  path text check (path in ('ai', 'production', 'hybrid')),
  path_suggested text check (path_suggested in ('ai', 'production', 'hybrid')),
  path_reason text,
  brief jsonb not null default '{}'::jsonb,
  current_stage smallint not null default 1 check (current_stage between 1 and 7),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_workspace_idx on public.projects (workspace_id, updated_at desc);
create index projects_created_by_idx on public.projects (created_by);

create table public.stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  number smallint not null check (number between 1 and 7),
  status text not null default 'locked' check (status in ('locked', 'active', 'approved')),
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  unique (project_id, number)
);
create index stages_workspace_idx on public.stages (workspace_id);
create index stages_approved_by_idx on public.stages (approved_by);

create table public.outputs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  stage smallint not null check (stage between 1 and 7),
  number smallint not null check (number between 1 and 55),
  status text not null default 'waiting' check (status in ('waiting', 'generating', 'ready', 'edited', 'approved', 'failed')),
  current_version integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (project_id, number)
);
create index outputs_workspace_idx on public.outputs (workspace_id);

-- Nothing is lost: every edit or regeneration adds a version. Versions are never changed.
create table public.versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  output_id uuid not null references public.outputs (id) on delete cascade,
  version integer not null check (version > 0),
  content jsonb not null,
  source text not null check (source in ('ai', 'edit', 'restore')),
  model text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (output_id, version)
);
create index versions_workspace_idx on public.versions (workspace_id);
create index versions_created_by_idx on public.versions (created_by);

-- The brief chat and the assistant panel.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  kind text not null default 'text' check (kind in ('text', 'voice')),
  content text not null check (char_length(content) <= 20000),
  audio_path text,
  audio_seconds numeric,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index messages_project_idx on public.messages (project_id, created_at);
create index messages_workspace_idx on public.messages (workspace_id);
create index messages_created_by_idx on public.messages (created_by);

-- Every AI call: task, provider, model, tokens or units, real cost, status. Written by the server only.
create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  task text not null,
  provider text not null,
  model text not null,
  status text not null check (status in ('success', 'failed')),
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric not null default 0,
  seconds numeric,
  error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ai_jobs_workspace_idx on public.ai_jobs (workspace_id, created_at desc);
create index ai_jobs_project_idx on public.ai_jobs (project_id);
create index ai_jobs_created_by_idx on public.ai_jobs (created_by);

-- The default model per task for a workspace. Missing rows mean Menab's default.
create table public.model_settings (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task text not null check (task in ('image', 'video', 'voice')),
  model_id text not null check (char_length(model_id) <= 120),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, task)
);
create index model_settings_updated_by_idx on public.model_settings (updated_by);

-- RLS
alter table public.projects enable row level security;
alter table public.stages enable row level security;
alter table public.outputs enable row level security;
alter table public.versions enable row level security;
alter table public.messages enable row level security;
alter table public.ai_jobs enable row level security;
alter table public.model_settings enable row level security;

revoke all on public.projects, public.stages, public.outputs, public.versions, public.messages, public.ai_jobs, public.model_settings from anon, authenticated;

grant select, insert on public.projects to authenticated;
grant update (name, client, path, path_suggested, path_reason, brief, current_stage, updated_at) on public.projects to authenticated;
grant select, insert on public.stages to authenticated;
grant update (status, approved_by, approved_at) on public.stages to authenticated;
grant select, insert on public.outputs to authenticated;
grant update (status, current_version, updated_at) on public.outputs to authenticated;
grant select, insert on public.versions to authenticated;
grant select, insert on public.messages to authenticated;
grant select on public.ai_jobs to authenticated;
grant select, insert, update on public.model_settings to authenticated;

create policy "Members read projects" on public.projects for select to authenticated
  using ((select private.is_member(workspace_id)));
create policy "Admins and Producers create projects" on public.projects for insert to authenticated
  with check ((select private.can_create_project(workspace_id)) and created_by = (select auth.uid()));
create policy "Editors change projects" on public.projects for update to authenticated
  using ((select private.can_edit(workspace_id))) with check ((select private.can_edit(workspace_id)));

create policy "Members read stages" on public.stages for select to authenticated
  using ((select private.is_member(workspace_id)));
create policy "Editors add stages" on public.stages for insert to authenticated
  with check ((select private.can_edit(workspace_id)));
create policy "Editors change stages" on public.stages for update to authenticated
  using ((select private.can_edit(workspace_id))) with check ((select private.can_edit(workspace_id)));

create policy "Members read outputs" on public.outputs for select to authenticated
  using ((select private.is_member(workspace_id)));
create policy "Editors add outputs" on public.outputs for insert to authenticated
  with check ((select private.can_edit(workspace_id)));
create policy "Editors change outputs" on public.outputs for update to authenticated
  using ((select private.can_edit(workspace_id))) with check ((select private.can_edit(workspace_id)));

create policy "Members read versions" on public.versions for select to authenticated
  using ((select private.is_member(workspace_id)));
create policy "Editors add versions" on public.versions for insert to authenticated
  with check ((select private.can_edit(workspace_id)) and created_by = (select auth.uid()));

create policy "Members read messages" on public.messages for select to authenticated
  using ((select private.is_member(workspace_id)));
create policy "Editors add messages" on public.messages for insert to authenticated
  with check ((select private.can_edit(workspace_id)) and created_by = (select auth.uid()));

create policy "Members read AI jobs" on public.ai_jobs for select to authenticated
  using ((select private.is_member(workspace_id)));

create policy "Members read model settings" on public.model_settings for select to authenticated
  using ((select private.is_member(workspace_id)));
create policy "Admins add model settings" on public.model_settings for insert to authenticated
  with check ((select private.is_admin(workspace_id)));
create policy "Admins change model settings" on public.model_settings for update to authenticated
  using ((select private.is_admin(workspace_id))) with check ((select private.is_admin(workspace_id)));

-- Child rows must belong to the same workspace as their project.
create function private.same_workspace_as_project()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.projects p where p.id = new.project_id and p.workspace_id = new.workspace_id) then
    raise exception 'Workspace does not match the project';
  end if;
  return new;
end;
$$;
create trigger stages_same_ws before insert on public.stages for each row execute function private.same_workspace_as_project();
create trigger outputs_same_ws before insert on public.outputs for each row execute function private.same_workspace_as_project();
create trigger messages_same_ws before insert on public.messages for each row execute function private.same_workspace_as_project();

create function private.version_same_workspace()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.outputs o where o.id = new.output_id and o.workspace_id = new.workspace_id) then
    raise exception 'Workspace does not match the output';
  end if;
  return new;
end;
$$;
create trigger versions_same_ws before insert on public.versions for each row execute function private.version_same_workspace();
