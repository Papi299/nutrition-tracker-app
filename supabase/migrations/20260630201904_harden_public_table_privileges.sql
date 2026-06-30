revoke all privileges on table public.profiles from anon;
revoke all privileges on table public.nutrition_targets from anon;
revoke all privileges on table public.diary_entries from anon;

revoke all privileges on table public.profiles from authenticated;
revoke all privileges on table public.nutrition_targets from authenticated;
revoke all privileges on table public.diary_entries from authenticated;

revoke all privileges on table public.profiles from public;
revoke all privileges on table public.nutrition_targets from public;
revoke all privileges on table public.diary_entries from public;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.nutrition_targets to authenticated;
grant select, insert, update, delete on table public.diary_entries to authenticated;

alter default privileges for role postgres in schema public
  revoke references, trigger, truncate, maintain on tables from anon;

alter default privileges for role postgres in schema public
  revoke references, trigger, truncate, maintain on tables from authenticated;
