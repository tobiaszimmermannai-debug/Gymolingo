-- Activity catalog (sports + everyday activities): cardio_sessions.activity holds any
-- catalog id instead of only walk/jog/run/ems. Idempotent (also pasted as an update).
alter table public.cardio_sessions drop constraint if exists cardio_sessions_activity_check;
alter table public.cardio_sessions add constraint cardio_sessions_activity_check check (activity ~ '^[a-z0-9_]{2,32}$');

-- schema version marker: lets the deploy check see which updates are installed
create or replace function public.gymolingo_schema()
returns int
language sql immutable set search_path = '' as $$ select 2026093003 $$;
grant execute on function public.gymolingo_schema() to anon, authenticated;
