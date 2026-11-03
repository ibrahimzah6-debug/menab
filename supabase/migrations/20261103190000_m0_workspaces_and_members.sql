-- M0: workspaces, members and roles.
-- One workspace per company. Every row is scoped by workspace and protected by RLS.

create type public.member_role as enum ('admin', 'producer', 'coordinator', 'viewer');
create type public.member_status as enum ('invited', 'active');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.member_role not null default 'viewer',
  -- Spending limit the Admin sets for a Coordinator, in US cents. Used from M5.
  spend_limit_cents integer check (spend_limit_cents is null or spend_limit_cents >= 0),
  status public.member_status not null default 'invited',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index members_user_id_idx on public.members (user_id);
create index members_workspace_id_idx on public.members (workspace_id);
create index members_invited_by_idx on public.members (invited_by);

-- Helper functions live in a schema the Data API does not expose.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.workspace_id = ws and m.user_id = (select auth.uid())
  );
$$;

create function private.is_admin(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and m.role = 'admin'
  );
$$;

revoke all on function private.is_member(uuid) from public;
revoke all on function private.is_admin(uuid) from public;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_admin(uuid) to authenticated;

-- Row-level security
alter table public.workspaces enable row level security;
alter table public.members enable row level security;

revoke all on public.workspaces from anon, authenticated;
revoke all on public.members from anon, authenticated;
grant select, update (name) on public.workspaces to authenticated;
grant select, delete on public.members to authenticated;
grant update (role, full_name, spend_limit_cents) on public.members to authenticated;

create policy "Members can see their workspace"
  on public.workspaces for select to authenticated
  using ((select private.is_member(id)));

create policy "Admins can rename their workspace"
  on public.workspaces for update to authenticated
  using ((select private.is_admin(id)))
  with check ((select private.is_admin(id)));

create policy "Members can see people in their workspace"
  on public.members for select to authenticated
  using ((select private.is_member(workspace_id)));

create policy "Admins can change members"
  on public.members for update to authenticated
  using ((select private.is_admin(workspace_id)))
  with check ((select private.is_admin(workspace_id)));

create policy "Admins can remove members"
  on public.members for delete to authenticated
  using ((select private.is_admin(workspace_id)));

-- New members are only added by the server (invite flow), never from the browser.

-- A workspace always keeps at least one Admin.
create function private.keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'admin'
     and (tg_op = 'DELETE' or new.role <> 'admin')
     and exists (select 1 from public.workspaces w where w.id = old.workspace_id)
     and not exists (
       select 1 from public.members m
       where m.workspace_id = old.workspace_id
         and m.role = 'admin'
         and m.id <> old.id
     ) then
    raise exception 'A workspace needs at least one Admin' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger members_keep_one_admin
  before update of role or delete on public.members
  for each row execute function private.keep_one_admin();

-- An invited member becomes active the first time they sign in.
create function private.activate_member_on_sign_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.last_sign_in_at is not null
     and old.last_sign_in_at is distinct from new.last_sign_in_at then
    update public.members
      set status = 'active'
      where user_id = new.id and status = 'invited';
  end if;
  return new;
end;
$$;

create trigger on_auth_user_signed_in
  after update of last_sign_in_at on auth.users
  for each row execute function private.activate_member_on_sign_in();

-- The first workspace: ZAH Production Services.
insert into public.workspaces (name) values ('ZAH Production Services');
