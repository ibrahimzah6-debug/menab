-- M1: AI provider test. One row per generation in the test, with Ibrahim's scores.
-- Admins only. Files are saved to the private "media" bucket and opened through expiring links.

create table public.provider_test_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  run_number integer not null check (run_number > 0),
  step text not null check (step in ('character', 'location', 'keyframe', 'video')),
  item_key text not null,
  model text not null,
  provider text not null default 'kie.ai',
  provider_model text not null,
  prompt text not null,
  request jsonb not null default '{}'::jsonb,
  task_id text,
  status text not null default 'waiting' check (status in ('waiting', 'generating', 'success', 'failed')),
  fail_reason text,
  credits numeric,
  cost_usd numeric,
  seconds numeric,
  source_url text,
  file_path text,
  mime_type text,
  quality smallint check (quality between 1 and 5),
  consistency smallint check (consistency between 1 and 5),
  arabic_text smallint check (arabic_text between 1 and 5),
  notes text check (char_length(notes) <= 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index provider_test_items_workspace_run_idx on public.provider_test_items (workspace_id, run_number);
create index provider_test_items_created_by_idx on public.provider_test_items (created_by);

alter table public.provider_test_items enable row level security;
revoke all on public.provider_test_items from anon, authenticated;
grant select on public.provider_test_items to authenticated;
grant update (quality, consistency, arabic_text, notes) on public.provider_test_items to authenticated;

create policy "Admins can see the provider test"
  on public.provider_test_items for select to authenticated
  using ((select private.is_admin(workspace_id)));

create policy "Admins can score the provider test"
  on public.provider_test_items for update to authenticated
  using ((select private.is_admin(workspace_id)))
  with check ((select private.is_admin(workspace_id)));

-- New rows and status changes come from the server only.

-- Private bucket for every generated file. No browser access; the server hands out expiring links.
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;
