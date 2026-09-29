-- Gymolingo Update 29.09. – NUR ausführen, wenn setup.sql vor diesem Update schon einmal ausgeführt wurde.
-- Enthält: Lauf/EMS (cardio_sessions), gemeinsamer Gemini-Schlüssel, Privatsphäre-Voreinstellung.

-- 20260929000005_cardio.sql
-- Endurance (walk / jog / run) and EMS training sessions; kcal computed in the app (MET).
create table public.cardio_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  date date not null,
  activity text not null check (activity in ('walk', 'jog', 'run', 'ems')),
  duration_min numeric(6, 1) not null check (duration_min > 0 and duration_min <= 1440),
  distance_km numeric(6, 2) check (distance_km is null or (distance_km > 0 and distance_km <= 500)),
  intensity text not null default 'medium' check (intensity in ('light', 'medium', 'intense')),
  kcal int not null default 0 check (kcal between 0 and 10000),
  kcal_manual boolean not null default false,
  note text
);
select private.make_synced('cardio_sessions');
create index cardio_sessions_user_date_idx on public.cardio_sessions (user_id, date);

-- optional: add burned calories to the daily calorie target
alter table public.athlete_profiles add column if not exists add_exercise_calories boolean not null default false;

-- 20260929000006_shared_ai_key.sql
-- One Gemini key for the whole test group: the owner stores it once in the app,
-- the owner's accepted friends receive it automatically (no setup for them).
-- Only reachable through the functions below (no direct table access).
create table public.shared_ai_key (
  id int primary key default 1 check (id = 1),
  owner_id uuid not null references auth.users (id) on delete cascade,
  gemini_key text not null check (length(gemini_key) between 20 and 200),
  hint text not null,
  updated_at timestamptz not null default now()
);
alter table public.shared_ai_key enable row level security;
revoke all on public.shared_ai_key from anon, authenticated;

create or replace function public.set_shared_ai_key(p_key text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.shared_ai_key where owner_id <> auth.uid()) then
    raise exception 'Ein anderer Nutzer hat bereits einen Schlüssel freigegeben.' using errcode = 'P0001';
  end if;
  insert into public.shared_ai_key (id, owner_id, gemini_key, hint, updated_at)
  values (1, auth.uid(), trim(p_key), right(trim(p_key), 4), now())
  on conflict (id) do update set gemini_key = excluded.gemini_key, hint = excluded.hint, updated_at = now();
end;
$$;

create or replace function public.clear_shared_ai_key()
returns void
language sql security definer set search_path = '' as $$
  delete from public.shared_ai_key where owner_id = auth.uid();
$$;

-- the owner and the owner's accepted friends get the key
create or replace function public.get_shared_ai_key()
returns table (gemini_key text, hint text, owner_name text, is_owner boolean)
language sql stable security definer set search_path = '' as $$
  select k.gemini_key, k.hint, coalesce(nullif(p.display_name, ''), p.username, 'Freund'), k.owner_id = auth.uid()
  from public.shared_ai_key k
  join public.profiles p on p.id = k.owner_id
  where auth.uid() is not null and private.are_friends(auth.uid(), k.owner_id);
$$;

revoke execute on function public.set_shared_ai_key(text), public.clear_shared_ai_key(), public.get_shared_ai_key() from public, anon;
grant execute on function public.set_shared_ai_key(text), public.clear_shared_ai_key(), public.get_shared_ai_key() to authenticated;

-- 20260929000007_privacy_defaults.sql
-- Privacy by default for new users: only streaks and "zuletzt online" are shared
-- with friends; everything else is opt-in (existing settings stay as they are).
alter table public.privacy_settings
  alter column share_workouts set default false,
  alter column share_steps set default false,
  alter column share_goal_completion set default false,
  alter column share_prs set default false,
  alter column share_level set default false;

create or replace function private.privacy_of(p_user uuid)
returns table (
  searchable boolean, share_workouts boolean, share_steps boolean, share_streaks boolean,
  share_goal_completion boolean, share_prs boolean, share_level boolean,
  share_weight boolean, share_body_fat boolean, share_nutrition boolean, share_photos boolean
) language sql stable security definer set search_path = '' as $$
  select coalesce(ps.searchable, true), coalesce(ps.share_workouts, false), coalesce(ps.share_steps, false),
         coalesce(ps.share_streaks, true), coalesce(ps.share_goal_completion, false), coalesce(ps.share_prs, false),
         coalesce(ps.share_level, false), coalesce(ps.share_weight, false), coalesce(ps.share_body_fat, false),
         coalesce(ps.share_nutrition, false), coalesce(ps.share_photos, false)
  from (select 1) dummy
  left join public.privacy_settings ps on ps.user_id = p_user and not ps.deleted;
$$;

-- 20260929000008_shared_key_all_users.sql
-- The owner's Gemini key is used by ALL signed-in users of this project
-- (small private test group) – no friendship needed.
create or replace function public.get_shared_ai_key()
returns table (gemini_key text, hint text, owner_name text, is_owner boolean)
language sql stable security definer set search_path = '' as $$
  select k.gemini_key, k.hint, coalesce(nullif(p.display_name, ''), p.username, 'Admin'), k.owner_id = auth.uid()
  from public.shared_ai_key k
  join public.profiles p on p.id = k.owner_id
  where auth.uid() is not null;
$$;
