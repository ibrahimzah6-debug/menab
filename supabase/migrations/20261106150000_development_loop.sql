-- The development loop (owner dashboard, Development): Menab learns from how it is used.
-- feedback: thumbs on replies and ideas from people. dev_reports and dev_items: an AI analyst
-- reads the last days of use and proposes fixes and features. ai_rules: lessons the owner
-- approves, added to Menab AI's instructions on every call.
-- dev_reports, dev_items and ai_rules are read and written only by the server (owner checked),
-- so they have RLS on and no policies.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('up', 'down', 'idea', 'bug')),
  message_id uuid references public.messages (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  text text check (char_length(text) <= 2000),
  page text check (char_length(page) <= 300),
  created_at timestamptz not null default now()
);
create index feedback_workspace_id_idx on public.feedback (workspace_id);
create index feedback_user_id_idx on public.feedback (user_id);
create index feedback_message_id_idx on public.feedback (message_id);
create index feedback_project_id_idx on public.feedback (project_id);
create index feedback_created_at_idx on public.feedback (created_at desc);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant insert on public.feedback to authenticated;
create policy "Members send feedback" on public.feedback for insert to authenticated
  with check ((select private.is_member(workspace_id)) and user_id = (select auth.uid()));

create table public.dev_reports (
  id uuid primary key default gen_random_uuid(),
  model text,
  summary text not null check (char_length(summary) <= 8000),
  stats jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.dev_reports enable row level security;
revoke all on public.dev_reports from anon, authenticated;

create table public.dev_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.dev_reports (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  detail text check (char_length(detail) <= 4000),
  evidence text check (char_length(evidence) <= 2000),
  kind text not null default 'fix' check (kind in ('fix', 'feature', 'prompt_rule', 'model', 'design')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'accepted', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dev_items_report_id_idx on public.dev_items (report_id);
create index dev_items_status_idx on public.dev_items (status, created_at desc);
alter table public.dev_items enable row level security;
revoke all on public.dev_items from anon, authenticated;

create table public.ai_rules (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(text) between 1 and 500),
  active boolean not null default true,
  source_item uuid references public.dev_items (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ai_rules_source_item_idx on public.ai_rules (source_item);
alter table public.ai_rules enable row level security;
revoke all on public.ai_rules from anon, authenticated;
