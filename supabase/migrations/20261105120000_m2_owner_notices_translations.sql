-- Owner dashboard, notices, automatic AI backup records, file attachments, translations.

-- People who run Menab itself (Ibrahim). They see every workspace on the owner dashboard.
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;
grant select on public.platform_admins to authenticated;
create policy "People see their own owner row" on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- Notices: AI backups, failures, finished generations, approvals waiting.
-- workspace_id null means a platform notice for the owner dashboard.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('ai_fallback', 'ai_failed', 'generation_done', 'approval_waiting', 'info')),
  title text not null check (char_length(title) <= 300),
  body text check (char_length(body) <= 2000),
  project_id uuid references public.projects (id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_workspace_idx on public.notifications (workspace_id, created_at desc);
create index notifications_project_idx on public.notifications (project_id);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy "Members read their workspace notices" on public.notifications for select to authenticated
  using (workspace_id is not null and (select private.is_member(workspace_id)));
create policy "Members mark notices read" on public.notifications for update to authenticated
  using (workspace_id is not null and (select private.is_member(workspace_id)))
  with check (workspace_id is not null and (select private.is_member(workspace_id)));

-- Which model was asked first when the backup answered.
alter table public.ai_jobs add column fallback_from text;

-- Files attached to a brief message (logos, products, references).
alter table public.messages add column attachments jsonb not null default '[]'::jsonb;

-- Interface translations made once per language and dictionary version. Server only.
create table public.translations (
  locale text not null,
  version text not null,
  dictionary jsonb not null,
  created_at timestamptz not null default now(),
  primary key (locale, version)
);
alter table public.translations enable row level security;
revoke all on public.translations from anon, authenticated;
