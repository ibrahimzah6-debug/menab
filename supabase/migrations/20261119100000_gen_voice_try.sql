-- A short try of a character's or the narrator's voice (her first line), heard before choosing.
alter table public.gen_assets drop constraint gen_assets_kind_check;
alter table public.gen_assets add constraint gen_assets_kind_check check (kind = any (array['sheet','outfit','keyframe','clip','voice','music','voicetry']));
