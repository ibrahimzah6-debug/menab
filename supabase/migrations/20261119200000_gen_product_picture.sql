-- A product picture made by AI in the reference lock: from the real photos, or designed from the description.
alter table public.gen_assets drop constraint gen_assets_kind_check;
alter table public.gen_assets add constraint gen_assets_kind_check check (kind = any (array['sheet','outfit','keyframe','clip','voice','music','voicetry','portrait','avatartry','product']));
