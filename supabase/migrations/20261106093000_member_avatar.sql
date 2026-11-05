-- Profile photo for each person (Settings, Account). The file sits in the private "media"
-- bucket under profiles/<user>/ and is shown through a short-lived signed link.
-- Changed by the app's server with the person's own session checked; no new grant needed.
alter table public.members add column avatar_path text check (char_length(avatar_path) <= 500);
