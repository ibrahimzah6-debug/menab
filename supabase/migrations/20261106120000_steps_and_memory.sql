-- What Menab did for each reply (shown under the reply, open to read), and workspace memory:
-- lasting facts Menab AI keeps about a company and its people and reads on every project.

alter table public.messages add column steps jsonb check (steps is null or jsonb_typeof(steps) = 'object');

alter table public.workspaces add column memory_on boolean not null default true;

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 300),
  source text not null default 'ai' check (source in ('ai', 'person')),
  project_id uuid references public.projects (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index memories_workspace_id_idx on public.memories (workspace_id, created_at desc);
create index memories_project_id_idx on public.memories (project_id);
create index memories_created_by_idx on public.memories (created_by);

alter table public.memories enable row level security;
revoke all on public.memories from anon, authenticated;
grant select, insert, delete on public.memories to authenticated;
grant update (content) on public.memories to authenticated;

create policy "Members read memory" on public.memories for select to authenticated using ((select private.is_member(workspace_id)));
create policy "Editors add memory" on public.memories for insert to authenticated with check ((select private.can_edit(workspace_id)));
create policy "Editors change memory" on public.memories for update to authenticated using ((select private.can_edit(workspace_id))) with check ((select private.can_edit(workspace_id)));
create policy "Editors remove memory" on public.memories for delete to authenticated using ((select private.can_edit(workspace_id)));
