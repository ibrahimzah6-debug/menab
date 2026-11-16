-- M6: the company's crew directory (Team, Crew) with GAMR registration, and national ID or iqama
-- numbers handled as system-architecture.md requires:
--   * stored encrypted (pgcrypto, key kept in Supabase Vault), in a separate column that members
--     cannot read;
--   * shown masked (last 4 digits) to everyone, in full only to Admins and Coordinators;
--   * never sent to an AI model (the app never reads them except to build a permit or PDF);
--   * every view, change or export logged in id_access_log.

create table public.crew (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  role text check (char_length(role) <= 120),
  department text check (char_length(department) <= 60),
  phone text check (char_length(phone) <= 40),
  email text check (char_length(email) <= 200),
  gamr_status text not null default 'unknown' check (gamr_status in ('registered', 'pending', 'not_registered', 'unknown')),
  gamr_number text check (char_length(gamr_number) <= 60),
  id_last4 text check (id_last4 ~ '^[0-9]{4}$'),
  id_cipher bytea,
  notes text check (char_length(notes) <= 2000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crew_workspace_id_idx on public.crew (workspace_id);
create index crew_created_by_idx on public.crew (created_by);

alter table public.crew enable row level security;
revoke all on public.crew from anon, authenticated;
-- Everything except the encrypted number; the masked last 4 are readable.
grant select (id, workspace_id, name, role, department, phone, email, gamr_status, gamr_number, id_last4, notes, created_by, created_at, updated_at) on public.crew to authenticated;
grant insert (workspace_id, name, role, department, phone, email, gamr_status, gamr_number, notes) on public.crew to authenticated;
grant update (name, role, department, phone, email, gamr_status, gamr_number, notes, updated_at) on public.crew to authenticated;
grant delete on public.crew to authenticated;
create policy "Members read crew" on public.crew for select to authenticated using ((select private.is_member(workspace_id)));
create policy "Editors add crew" on public.crew for insert to authenticated with check ((select private.can_edit(workspace_id)));
create policy "Editors change crew" on public.crew for update to authenticated using ((select private.can_edit(workspace_id))) with check ((select private.can_edit(workspace_id)));
create policy "Editors remove crew" on public.crew for delete to authenticated using ((select private.can_edit(workspace_id)));

create table public.id_access_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  crew_id uuid references public.crew (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('set', 'view', 'export', 'clear')),
  created_at timestamptz not null default now()
);
create index id_access_log_workspace_idx on public.id_access_log (workspace_id, created_at desc);
create index id_access_log_crew_id_idx on public.id_access_log (crew_id);
create index id_access_log_user_id_idx on public.id_access_log (user_id);
alter table public.id_access_log enable row level security;
revoke all on public.id_access_log from anon, authenticated;
grant select on public.id_access_log to authenticated;
create policy "Admins read the ID log" on public.id_access_log for select to authenticated using ((select private.is_admin(workspace_id)));

-- The encryption key lives in Vault, never in the app or the repo.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'crew_id_key', 'Encrypts crew national ID and iqama numbers');

create function private.crew_id_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'crew_id_key' limit 1;
$$;
revoke all on function private.crew_id_key() from public, anon, authenticated;

-- Set, change or clear a crew member's ID number (Admins, Producers and Coordinators).
create function public.set_crew_id(p_crew uuid, id_number text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  clean text := regexp_replace(coalesce(id_number, ''), '[^0-9]', '', 'g');
begin
  select workspace_id into ws from public.crew where id = p_crew;
  if ws is null or not private.can_edit(ws) then
    raise exception 'Not allowed';
  end if;
  if clean = '' then
    update public.crew set id_cipher = null, id_last4 = null, updated_at = now() where id = p_crew;
    insert into public.id_access_log (workspace_id, crew_id, user_id, action) values (ws, p_crew, auth.uid(), 'clear');
    return;
  end if;
  if clean !~ '^[12][0-9]{9}$' then
    raise exception 'A national ID or iqama number has 10 digits and starts with 1 or 2';
  end if;
  update public.crew
    set id_cipher = extensions.pgp_sym_encrypt(clean, private.crew_id_key()), id_last4 = right(clean, 4), updated_at = now()
    where id = p_crew;
  insert into public.id_access_log (workspace_id, crew_id, user_id, action) values (ws, p_crew, auth.uid(), 'set');
end;
$$;
revoke all on function public.set_crew_id(uuid, text) from public, anon;
grant execute on function public.set_crew_id(uuid, text) to authenticated;

-- Show a full ID number: Admins and Coordinators only, and every view is logged.
create function public.reveal_crew_id(p_crew uuid, purpose text default 'view')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  cipher bytea;
begin
  select workspace_id, id_cipher into ws, cipher from public.crew where id = p_crew;
  if ws is null or coalesce(private.member_role(ws)::text, '') not in ('admin', 'coordinator') then
    raise exception 'Not allowed';
  end if;
  if cipher is null then
    return null;
  end if;
  insert into public.id_access_log (workspace_id, crew_id, user_id, action) values (ws, p_crew, auth.uid(), case when purpose = 'export' then 'export' else 'view' end);
  return extensions.pgp_sym_decrypt(cipher, private.crew_id_key());
end;
$$;
revoke all on function public.reveal_crew_id(uuid, text) from public, anon;
grant execute on function public.reveal_crew_id(uuid, text) to authenticated;
