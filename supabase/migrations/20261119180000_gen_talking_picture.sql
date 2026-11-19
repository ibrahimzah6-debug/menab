-- The talking picture of a character and a short lip-sync test, made in the reference lock.
alter table public.gen_assets drop constraint gen_assets_kind_check;
alter table public.gen_assets add constraint gen_assets_kind_check check (kind = any (array['sheet','outfit','keyframe','clip','voice','music','voicetry','portrait','avatartry']));
