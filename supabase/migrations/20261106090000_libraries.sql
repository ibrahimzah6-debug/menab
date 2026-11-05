-- Libraries: what a company reuses across projects (information-architecture.md, system-architecture.md).
-- Brand kits, characters, locations and assets. Every row carries workspace_id and RLS:
-- members read, Admin, Producer and Coordinator add, change and remove.
-- Files live in the private "media" bucket under <workspace>/library/...; the app shows them
-- through short-lived signed links.

create table public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  logo_path text check (char_length(logo_path) <= 500),
  colors text[] not null default '{}' check (cardinality(colors) <= 12),
  fonts text[] not null default '{}' check (cardinality(fonts) <= 6),
  tone text check (char_length(tone) <= 2000),
  notes text check (char_length(notes) <= 4000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 4000),
  age text check (char_length(age) <= 60),
  look text check (char_length(look) <= 4000),
  wardrobe text check (char_length(wardrobe) <= 4000),
  voice text check (char_length(voice) <= 1000),
  image_paths text[] not null default '{}' check (cardinality(image_paths) <= 12),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 4000),
  city text check (char_length(city) <= 120),
  kind text check (kind in ('real', 'ai', 'either')),
  image_paths text[] not null default '{}' check (cardinality(image_paths) <= 12),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  path text not null check (char_length(path) <= 500),
  mime text not null check (char_length(mime) <= 120),
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  kind text not null default 'other' check (kind in ('logo', 'product', 'reference', 'music', 'footage', 'document', 'other')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index brand_kits_workspace_id_idx on public.brand_kits (workspace_id);
create index characters_workspace_id_idx on public.characters (workspace_id);
create index locations_workspace_id_idx on public.locations (workspace_id);
create index assets_workspace_id_idx on public.assets (workspace_id, created_at desc);
create index brand_kits_created_by_idx on public.brand_kits (created_by);
create index characters_created_by_idx on public.characters (created_by);
create index locations_created_by_idx on public.locations (created_by);
create index assets_created_by_idx on public.assets (created_by);

alter table public.brand_kits enable row level security;
alter table public.characters enable row level security;
alter table public.locations enable row level security;
alter table public.assets enable row level security;

revoke all on public.brand_kits, public.characters, public.locations, public.assets from anon, authenticated;
grant select, insert, delete on public.brand_kits, public.characters, public.locations, public.assets to authenticated;
grant update (name, logo_path, colors, fonts, tone, notes, updated_at) on public.brand_kits to authenticated;
grant update (name, description, age, look, wardrobe, voice, image_paths, updated_at) on public.characters to authenticated;
grant update (name, description, city, kind, image_paths, updated_at) on public.locations to authenticated;
grant update (name, kind) on public.assets to authenticated;

create policy "Members read brand kits" on public.brand_kits for select to authenticated using ((select private.is_member(workspace_id)));
create policy "Editors add brand kits" on public.brand_kits for insert to authenticated with check ((select private.can_edit(workspace_id)));
create policy "Editors change brand kits" on public.brand_kits for update to authenticated using ((select private.can_edit(workspace_id))) with check ((select private.can_edit(workspace_id)));
create policy "Editors remove brand kits" on public.brand_kits for delete to authenticated using ((select private.can_edit(workspace_id)));

create policy "Members read characters" on public.characters for select to authenticated using ((select private.is_member(workspace_id)));
create policy "Editors add characters" on public.characters for insert to authenticated with check ((select private.can_edit(workspace_id)));
create policy "Editors change characters" on public.characters for update to authenticated using ((select private.can_edit(workspace_id))) with check ((select private.can_edit(workspace_id)));
create policy "Editors remove characters" on public.characters for delete to authenticated using ((select private.can_edit(workspace_id)));

create policy "Members read locations" on public.locations for select to authenticated using ((select private.is_member(workspace_id)));
create policy "Editors add locations" on public.locations for insert to authenticated with check ((select private.can_edit(workspace_id)));
create policy "Editors change locations" on public.locations for update to authenticated using ((select private.can_edit(workspace_id))) with check ((select private.can_edit(workspace_id)));
create policy "Editors remove locations" on public.locations for delete to authenticated using ((select private.can_edit(workspace_id)));

create policy "Members read assets" on public.assets for select to authenticated using ((select private.is_member(workspace_id)));
create policy "Editors add assets" on public.assets for insert to authenticated with check ((select private.can_edit(workspace_id)));
create policy "Editors change assets" on public.assets for update to authenticated using ((select private.can_edit(workspace_id))) with check ((select private.can_edit(workspace_id)));
create policy "Editors remove assets" on public.assets for delete to authenticated using ((select private.can_edit(workspace_id)));
