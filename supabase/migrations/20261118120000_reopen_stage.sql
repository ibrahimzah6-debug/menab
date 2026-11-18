-- Reopening an approved stage (Admins and Producers). A reopened stage remembers when it was
-- reopened; when it is approved again with changes, documents in later stages are marked as
-- made before that change until they get a new version.
alter table public.stages add column if not exists reopened_at timestamptz;
alter table public.outputs add column if not exists stale_from smallint;
comment on column public.outputs.stale_from is 'Stage number whose later change this output was made before. Cleared on its next version.';

-- People update these through the app (row-level security still applies).
grant update (reopened_at) on public.stages to authenticated;
grant update (stale_from) on public.outputs to authenticated;
