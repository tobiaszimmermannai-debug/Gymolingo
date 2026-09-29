-- Gymolingo – komplette Datenbank-Einrichtung (generiert aus supabase/migrations, nicht von Hand ändern)
-- Supabase → SQL Editor → New query → alles einfügen → Run. Nur EINMAL pro Projekt ausführen.

-- ============================================================
-- 20260928000001_schema.sql
-- ============================================================
-- =====================================================================
-- Gymolingo schema
-- All user-owned tables are synced offline-first (last-write-wins).
-- Column names match packages/core/src/types.ts.
-- =====================================================================

create schema if not exists private;

-- ---------------------------------------------------------------------
-- Sync helper trigger:
--  * server_updated_at = clock_timestamp() (pull cursor)
--  * last-write-wins: an update with an older updated_at is ignored
--  * user_id and id are immutable
-- ---------------------------------------------------------------------
create or replace function private.sync_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null; -- stale write from an offline device: keep newer row
    end if;
    new.user_id := old.user_id;
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- Creates the standard sync columns, trigger, index and RLS policies.
create or replace function private.make_synced(tbl text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('create trigger sync_row before insert or update on public.%I for each row execute function private.sync_row()', tbl);
  execute format('create index %I on public.%I (user_id, server_updated_at)', tbl || '_sync_idx', tbl);
  execute format('alter table public.%I enable row level security', tbl);
  execute format('create policy "own rows: select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', tbl);
  execute format('create policy "own rows: insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', tbl);
  execute format('create policy "own rows: update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', tbl);
  execute format('create policy "own rows: delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', tbl);
end;
$$;

-- ---------------------------------------------------------------------
-- Public identity (visible to friends / search via RPCs only)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text not null default '',
  avatar_emoji text not null default '💪',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username is null or username ~ '^[a-z0-9_.]{3,20}$')
);
alter table public.profiles enable row level security;
create policy "profiles: own select" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: own update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- Athlete profile (private)
-- ---------------------------------------------------------------------
create table public.athlete_profiles (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  display_name text not null default '',
  birth_year int check (birth_year between 1900 and 2100),
  sex text check (sex in ('male', 'female', 'diverse')),
  height_cm numeric(5, 1) check (height_cm between 80 and 260),
  start_weight_kg numeric(5, 1),
  goal_weight_kg numeric(5, 1),
  experience_level text not null default 'beginner' check (experience_level in ('beginner', 'intermediate', 'advanced')),
  training_years numeric(4, 1),
  goal text not null default 'muscle_gain' check (goal in ('muscle_gain', 'fat_loss', 'recomposition', 'strength')),
  activity_level text not null default 'moderate' check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  schedule_type text not null default 'per_week' check (schedule_type in ('fixed_days', 'per_week')),
  training_days_per_week int not null default 3 check (training_days_per_week between 0 and 7),
  training_weekdays int[] not null default '{}',
  preferred_workout_time text not null default '18:00',
  equipment text[] not null default '{}',
  diet_type text not null default 'omnivore',
  allergies text[] not null default '{}',
  intolerances text[] not null default '{}',
  targets_mode text not null default 'auto' check (targets_mode in ('auto', 'manual')),
  calorie_target int not null default 2200,
  protein_target_g int not null default 150,
  carbs_target_g int not null default 220,
  fat_target_g int not null default 70,
  fiber_target_g int not null default 30,
  step_target int not null default 8000,
  weekly_rate_kg numeric(4, 2) not null default 0,
  weight_tracking_enabled boolean not null default true,
  onboarding_completed boolean not null default false,
  constraint one_profile_per_user check (id = user_id)
);
select private.make_synced('athlete_profiles');

-- ---------------------------------------------------------------------
-- Privacy & reminder settings (one row per user, id = user_id)
-- Sensitive data (weight, body fat, nutrition, photos) is private by default.
-- ---------------------------------------------------------------------
create table public.privacy_settings (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  searchable boolean not null default true,
  share_workouts boolean not null default true,
  share_steps boolean not null default true,
  share_streaks boolean not null default true,
  share_goal_completion boolean not null default true,
  share_prs boolean not null default true,
  share_level boolean not null default true,
  share_weight boolean not null default false,
  share_body_fat boolean not null default false,
  share_nutrition boolean not null default false,
  share_photos boolean not null default false,
  constraint one_privacy_per_user check (id = user_id)
);
select private.make_synced('privacy_settings');

create table public.reminder_settings (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  enabled boolean not null default true,
  morning_enabled boolean not null default true,
  morning_time text not null default '07:30',
  pre_workout_enabled boolean not null default true,
  pre_workout_minutes int not null default 60,
  post_workout_enabled boolean not null default true,
  evening_enabled boolean not null default true,
  evening_time text not null default '20:30',
  weight_enabled boolean not null default true,
  weight_time text not null default '07:00',
  nutrition_enabled boolean not null default true,
  streak_enabled boolean not null default true,
  weekly_report_enabled boolean not null default true,
  quiet_start text not null default '22:00',
  quiet_end text not null default '07:00',
  max_per_day int not null default 5 check (max_per_day between 0 and 12),
  intensity text not null default 'normal' check (intensity in ('gentle', 'normal', 'persistent')),
  constraint one_reminder_settings_per_user check (id = user_id)
);
select private.make_synced('reminder_settings');

-- ---------------------------------------------------------------------
-- Training
-- ---------------------------------------------------------------------
create table public.custom_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  name text not null,
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  equipment text not null,
  category text not null default 'compound',
  increment_kg numeric(5, 2) not null default 2.5,
  is_bodyweight boolean not null default false,
  default_rep_min int not null default 8,
  default_rep_max int not null default 12,
  instructions text
);
select private.make_synced('custom_exercises');

create table public.workout_plans (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  name text not null,
  description text,
  is_active boolean not null default false,
  sort_order int not null default 0
);
select private.make_synced('workout_plans');

create table public.plan_days (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  name text not null,
  weekday int check (weekday between 0 and 6),
  sort_order int not null default 0
);
select private.make_synced('plan_days');
create index plan_days_plan_idx on public.plan_days (plan_id);

create table public.plan_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  plan_day_id uuid not null references public.plan_days (id) on delete cascade,
  exercise_id text not null,
  sort_order int not null default 0,
  target_sets int not null default 3 check (target_sets between 1 and 20),
  rep_min int not null default 8 check (rep_min between 1 and 100),
  rep_max int not null default 12 check (rep_max between 1 and 100),
  target_rir int not null default 2 check (target_rir between 0 and 10),
  rest_seconds int not null default 120,
  increment_kg numeric(5, 2),
  notes text
);
select private.make_synced('plan_exercises');
create index plan_exercises_day_idx on public.plan_exercises (plan_day_id);

create table public.workout_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  plan_day_id uuid references public.plan_days (id) on delete set null,
  name text not null,
  date date not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  status text not null check (status in ('active', 'paused', 'completed', 'discarded')),
  paused_at timestamptz,
  paused_seconds int not null default 0,
  notes text
);
select private.make_synced('workout_sessions');
create index workout_sessions_user_date_idx on public.workout_sessions (user_id, date);

create table public.workout_sets (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id text not null,
  exercise_order int not null default 0,
  set_index int not null default 0,
  set_type text not null default 'working' check (set_type in ('warmup', 'working', 'drop', 'failure')),
  weight_kg numeric(6, 2) not null default 0 check (weight_kg >= 0 and weight_kg < 1000),
  reps int not null default 0 check (reps >= 0 and reps < 1000),
  rir numeric(3, 1) check (rir between 0 and 10),
  rpe numeric(3, 1) check (rpe between 1 and 10),
  completed boolean not null default false,
  completed_at timestamptz,
  rest_seconds int,
  target_weight_kg numeric(6, 2),
  target_reps int
);
select private.make_synced('workout_sets');
create index workout_sets_session_idx on public.workout_sets (session_id);

-- ---------------------------------------------------------------------
-- Nutrition
-- ---------------------------------------------------------------------
create table public.custom_foods (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  name text not null,
  brand text,
  barcode text,
  kcal_100 numeric(6, 1) not null check (kcal_100 between 0 and 900),
  protein_100 numeric(5, 1) not null check (protein_100 between 0 and 100),
  carbs_100 numeric(5, 1) not null check (carbs_100 between 0 and 100),
  fat_100 numeric(5, 1) not null check (fat_100 between 0 and 100),
  fiber_100 numeric(5, 1),
  sugar_100 numeric(5, 1),
  salt_100 numeric(5, 2),
  serving_label text,
  serving_g numeric(7, 1),
  source text not null default 'custom' check (source in ('custom', 'off', 'ai', 'recipe', 'builtin')),
  is_estimate boolean not null default false,
  favorite boolean not null default false
);
select private.make_synced('custom_foods');

create table public.recipes (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  name text not null,
  servings numeric(5, 1) not null default 1 check (servings > 0),
  notes text
);
select private.make_synced('recipes');

create table public.recipe_items (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  food_ref text not null,
  name text not null,
  amount_g numeric(7, 1) not null check (amount_g > 0),
  kcal_100 numeric(6, 1) not null,
  protein_100 numeric(5, 1) not null,
  carbs_100 numeric(5, 1) not null,
  fat_100 numeric(5, 1) not null,
  fiber_100 numeric(5, 1),
  sugar_100 numeric(5, 1),
  salt_100 numeric(5, 2)
);
select private.make_synced('recipe_items');

create table public.meal_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  date date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_ref text not null,
  name text not null,
  brand text,
  amount_g numeric(7, 1) not null check (amount_g > 0),
  serving_label text,
  kcal numeric(7, 1) not null check (kcal >= 0),
  protein_g numeric(6, 1) not null check (protein_g >= 0),
  carbs_g numeric(6, 1) not null check (carbs_g >= 0),
  fat_g numeric(6, 1) not null check (fat_g >= 0),
  fiber_g numeric(6, 1),
  source text not null default 'builtin',
  is_estimate boolean not null default false,
  estimate_note text,
  logged_at timestamptz not null default now()
);
select private.make_synced('meal_entries');
create index meal_entries_user_date_idx on public.meal_entries (user_id, date);

-- ---------------------------------------------------------------------
-- Body, steps, check-ins, streak pauses, achievements
-- ---------------------------------------------------------------------
create table public.weight_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  date date not null,
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 2 and 70),
  source text not null default 'manual' check (source in ('manual', 'apple_health', 'health_connect')),
  note text
);
select private.make_synced('weight_entries');
create index weight_entries_user_date_idx on public.weight_entries (user_id, date);

create table public.body_measurements (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  date date not null,
  waist_cm numeric(5, 1),
  chest_cm numeric(5, 1),
  hips_cm numeric(5, 1),
  arm_cm numeric(5, 1),
  thigh_cm numeric(5, 1),
  neck_cm numeric(5, 1),
  note text
);
select private.make_synced('body_measurements');

create table public.progress_photos (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  date date not null,
  pose text not null default 'front' check (pose in ('front', 'side', 'back')),
  storage_path text,
  note text
);
select private.make_synced('progress_photos');

create table public.step_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  date date not null,
  steps int not null check (steps between 0 and 200000),
  source text not null default 'manual' check (source in ('manual', 'apple_health', 'health_connect'))
);
select private.make_synced('step_entries');
create index step_entries_user_date_idx on public.step_entries (user_id, date);

create table public.daily_checkins (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  date date not null,
  mood int check (mood between 1 and 5),
  energy int check (energy between 1 and 5),
  sleep_hours numeric(3, 1) check (sleep_hours between 0 and 24),
  note text,
  day_closed boolean not null default true,
  completed_at timestamptz not null default now()
);
select private.make_synced('daily_checkins');

create table public.streak_pauses (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  start_date date not null,
  end_date date not null,
  reason text not null default 'vacation' check (reason in ('vacation', 'sick', 'other')),
  constraint pause_range check (end_date >= start_date and end_date - start_date <= 60)
);
select private.make_synced('streak_pauses');

create table public.user_achievements (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  badge_id text not null,
  unlocked_at timestamptz not null default now(),
  seen boolean not null default false
);
select private.make_synced('user_achievements');

-- ---------------------------------------------------------------------
-- Coach
-- ---------------------------------------------------------------------
create table public.coach_messages (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  role text not null check (role in ('user', 'assistant')),
  content text not null check (length(content) <= 8000),
  source text not null default 'rules' check (source in ('ai', 'rules'))
);
select private.make_synced('coach_messages');

create table public.ai_reports (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  week_start date not null,
  stats jsonb not null,
  content jsonb not null,
  source text not null default 'rules' check (source in ('ai', 'rules')),
  model text
);
select private.make_synced('ai_reports');

-- ---------------------------------------------------------------------
-- Public snapshot of derived stats (level, streaks, PRs) – written by the
-- client, shown to friends only via RPC respecting privacy settings.
-- ---------------------------------------------------------------------
create table public.profile_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  level int not null default 1,
  total_xp int not null default 0,
  streaks jsonb not null default '{}',
  recent_prs jsonb not null default '[]',
  badges int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.profile_snapshots enable row level security;
create policy "snapshots: own all" on public.profile_snapshots for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  token text not null unique,
  platform text not null,
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
create policy "push tokens: own all" on public.push_tokens for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ============================================================
-- 20260928000002_community.sql
-- ============================================================
-- =====================================================================
-- Community: friendships, private challenges, leaderboards.
-- Other users' raw data is never readable through RLS. Friends only see
-- aggregated values via SECURITY DEFINER functions that check the
-- friendship AND the owner's privacy settings.
-- =====================================================================

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint no_self_friendship check (requester_id <> addressee_id)
);
create unique index friendships_pair_idx on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
alter table public.friendships enable row level security;
create policy "friendships: participants read" on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (length(title) between 3 and 80),
  metric text not null check (metric in ('steps', 'workouts', 'volume', 'goal_completion', 'protein_days')),
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  constraint challenge_range check (end_date >= start_date and end_date - start_date <= 92)
);

create table public.challenge_participants (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'joined', 'declined')),
  joined_at timestamptz,
  primary key (challenge_id, user_id)
);

alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;

create or replace function private.is_challenge_member(p_challenge uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.challenge_participants cp where cp.challenge_id = p_challenge and cp.user_id = p_user)
      or exists (select 1 from public.challenges c where c.id = p_challenge and c.creator_id = p_user);
$$;

create policy "challenges: members read" on public.challenges for select to authenticated
  using (private.is_challenge_member(id, (select auth.uid())));
create policy "participants: members read" on public.challenge_participants for select to authenticated
  using (private.is_challenge_member(challenge_id, (select auth.uid())));

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function private.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select a = b or exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id) = least(a, b)
      and greatest(f.requester_id, f.addressee_id) = greatest(a, b)
  );
$$;

-- Privacy settings with defaults if the row was not synced yet.
create or replace function private.privacy_of(p_user uuid)
returns table (
  searchable boolean, share_workouts boolean, share_steps boolean, share_streaks boolean,
  share_goal_completion boolean, share_prs boolean, share_level boolean,
  share_weight boolean, share_body_fat boolean, share_nutrition boolean, share_photos boolean
) language sql stable security definer set search_path = '' as $$
  select coalesce(ps.searchable, true), coalesce(ps.share_workouts, true), coalesce(ps.share_steps, true),
         coalesce(ps.share_streaks, true), coalesce(ps.share_goal_completion, true), coalesce(ps.share_prs, true),
         coalesce(ps.share_level, true), coalesce(ps.share_weight, false), coalesce(ps.share_body_fat, false),
         coalesce(ps.share_nutrition, false), coalesce(ps.share_photos, false)
  from (select 1) dummy
  left join public.privacy_settings ps on ps.user_id = p_user and not ps.deleted;
$$;

-- Aggregated stats of a user in a period (internal – callers check permissions).
create or replace function private.period_stats(p_user uuid, p_from date, p_to date)
returns table (steps_total bigint, step_days_hit int, workouts int, volume_kg numeric, protein_days_hit int, goal_completion_pct int)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_days int := greatest(1, p_to - p_from + 1);
  v_step_target int;
  v_protein_target int;
  v_per_week int;
  v_planned numeric;
begin
  select ap.step_target, ap.protein_target_g, ap.training_days_per_week
    into v_step_target, v_protein_target, v_per_week
  from public.athlete_profiles ap where ap.user_id = p_user and not ap.deleted;

  -- one value per day: manual entries win, otherwise max of health sources
  select coalesce(sum(d.steps), 0), count(*) filter (where v_step_target > 0 and d.steps >= v_step_target)
    into steps_total, step_days_hit
  from (
    select distinct on (se.date) se.date, se.steps
    from public.step_entries se
    where se.user_id = p_user and not se.deleted and se.date between p_from and p_to
    order by se.date, (se.source = 'manual') desc, case when se.source = 'manual' then extract(epoch from se.updated_at) else se.steps end desc
  ) d;

  select count(*)::int into workouts
  from public.workout_sessions ws
  where ws.user_id = p_user and not ws.deleted and ws.status = 'completed' and ws.date between p_from and p_to;

  select coalesce(sum(s.weight_kg * s.reps), 0) into volume_kg
  from public.workout_sets s
  join public.workout_sessions ws on ws.id = s.session_id
  where s.user_id = p_user and not s.deleted and s.completed and s.set_type <> 'warmup'
    and not ws.deleted and ws.status = 'completed' and ws.date between p_from and p_to;

  select count(*)::int into protein_days_hit
  from (
    select me.date, sum(me.protein_g) as p
    from public.meal_entries me
    where me.user_id = p_user and not me.deleted and me.date between p_from and p_to
    group by me.date
  ) x
  where v_protein_target > 0 and x.p >= v_protein_target * 0.95;

  v_planned := greatest(1, coalesce(v_per_week, 3) * v_days / 7.0);
  goal_completion_pct := round(100 * (
      least(1, workouts / v_planned)
    + (step_days_hit::numeric / v_days)
    + (protein_days_hit::numeric / v_days)
  ) / 3);
  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- Public RPCs
-- ---------------------------------------------------------------------
create or replace function public.search_users(p_query text)
returns table (id uuid, username text, display_name text, avatar_emoji text, friendship_status text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name, p.avatar_emoji,
         (select case when f.status = 'accepted' then 'friends'
                      when f.status = 'pending' and f.requester_id = auth.uid() then 'outgoing'
                      when f.status = 'pending' then 'incoming'
                      else f.status end
          from public.friendships f
          where least(f.requester_id, f.addressee_id) = least(p.id, auth.uid())
            and greatest(f.requester_id, f.addressee_id) = greatest(p.id, auth.uid())) as friendship_status
  from public.profiles p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and p.username is not null
    and length(trim(p_query)) >= 2
    and (select searchable from private.privacy_of(p.id))
    and (p.username ilike replace(replace(lower(trim(p_query)), '%', ''), '_', '\_') || '%'
         or p.display_name ilike '%' || replace(trim(p_query), '%', '') || '%')
  order by p.username
  limit 20;
$$;

create or replace function public.send_friend_request(p_username text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_other uuid;
  v_existing public.friendships;
  v_id uuid;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  select id into v_other from public.profiles where username = lower(trim(p_username));
  if v_other is null then raise exception 'Nutzer nicht gefunden'; end if;
  if v_other = v_me then raise exception 'Du kannst dich nicht selbst hinzufügen'; end if;

  select * into v_existing from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(v_me, v_other)
    and greatest(f.requester_id, f.addressee_id) = greatest(v_me, v_other);

  if found then
    if v_existing.status = 'accepted' then return v_existing.id; end if;
    if v_existing.status = 'pending' and v_existing.addressee_id = v_me then
      -- the other person already asked: accept
      update public.friendships set status = 'accepted', responded_at = now() where id = v_existing.id;
      return v_existing.id;
    end if;
    if v_existing.status = 'declined' then
      update public.friendships set requester_id = v_me, addressee_id = v_other, status = 'pending', created_at = now(), responded_at = null
      where id = v_existing.id;
      return v_existing.id;
    end if;
    return v_existing.id; -- already pending from me
  end if;

  insert into public.friendships (requester_id, addressee_id) values (v_me, v_other) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.friendships
     set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
   where id = p_request_id and addressee_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Anfrage nicht gefunden'; end if;
end;
$$;

create or replace function public.remove_friend(p_user_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.friendships f
  where least(f.requester_id, f.addressee_id) = least(auth.uid(), p_user_id)
    and greatest(f.requester_id, f.addressee_id) = greatest(auth.uid(), p_user_id);
end;
$$;

create or replace function public.list_friends()
returns table (request_id uuid, user_id uuid, username text, display_name text, avatar_emoji text, status text, direction text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select f.id,
         other.id, other.username, other.display_name, other.avatar_emoji,
         f.status,
         case when f.requester_id = auth.uid() then 'outgoing' else 'incoming' end,
         f.created_at
  from public.friendships f
  join public.profiles other on other.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() in (f.requester_id, f.addressee_id)
    and f.status in ('pending', 'accepted')
  order by f.status, other.display_name;
$$;

-- Friend profile: only what the friend allows to share.
create or replace function public.get_friend_profile(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_priv record;
  v_prof public.profiles;
  v_snap public.profile_snapshots;
  v_week record;
  v_result jsonb;
  v_today date := current_date;
begin
  if auth.uid() is null or not private.are_friends(auth.uid(), p_user_id) then
    raise exception 'Kein Zugriff';
  end if;
  select * into v_priv from private.privacy_of(p_user_id);
  select * into v_prof from public.profiles where id = p_user_id;
  select * into v_snap from public.profile_snapshots where user_id = p_user_id;
  select * into v_week from private.period_stats(p_user_id, v_today - 6, v_today);

  v_result := jsonb_build_object(
    'user_id', p_user_id,
    'username', v_prof.username,
    'display_name', v_prof.display_name,
    'avatar_emoji', v_prof.avatar_emoji,
    'level', case when v_priv.share_level then v_snap.level end,
    'total_xp', case when v_priv.share_level then v_snap.total_xp end,
    'badges', case when v_priv.share_level then v_snap.badges end,
    'streaks', case when v_priv.share_streaks then v_snap.streaks end,
    'recent_prs', case when v_priv.share_prs then v_snap.recent_prs end,
    'week_workouts', case when v_priv.share_workouts then v_week.workouts end,
    'week_volume_kg', case when v_priv.share_workouts then v_week.volume_kg end,
    'week_steps', case when v_priv.share_steps then v_week.steps_total end,
    'week_goal_completion_pct', case when v_priv.share_goal_completion then v_week.goal_completion_pct end,
    'shared', jsonb_build_object(
      'workouts', v_priv.share_workouts, 'steps', v_priv.share_steps, 'streaks', v_priv.share_streaks,
      'goal_completion', v_priv.share_goal_completion, 'prs', v_priv.share_prs, 'level', v_priv.share_level,
      'weight', v_priv.share_weight, 'body_fat', v_priv.share_body_fat, 'nutrition', v_priv.share_nutrition,
      'photos', v_priv.share_photos)
  );

  if v_priv.share_weight then
    v_result := v_result || jsonb_build_object('latest_weight', (
      select jsonb_build_object('date', w.date, 'weight_kg', w.weight_kg)
      from public.weight_entries w where w.user_id = p_user_id and not w.deleted order by w.date desc, w.updated_at desc limit 1));
  end if;
  if v_priv.share_body_fat then
    v_result := v_result || jsonb_build_object('latest_body_fat', (
      select jsonb_build_object('date', w.date, 'body_fat_pct', w.body_fat_pct)
      from public.weight_entries w where w.user_id = p_user_id and not w.deleted and w.body_fat_pct is not null
      order by w.date desc, w.updated_at desc limit 1));
  end if;
  if v_priv.share_nutrition then
    v_result := v_result || jsonb_build_object('nutrition_7d', (
      select jsonb_build_object('avg_kcal', round(avg(d.kcal)), 'avg_protein_g', round(avg(d.p)), 'days', count(*))
      from (select me.date, sum(me.kcal) kcal, sum(me.protein_g) p from public.meal_entries me
            where me.user_id = p_user_id and not me.deleted and me.date between v_today - 6 and v_today group by me.date) d));
  end if;
  if v_priv.share_photos then
    v_result := v_result || jsonb_build_object('photos', (
      select coalesce(jsonb_agg(jsonb_build_object('date', pp.date, 'pose', pp.pose, 'storage_path', pp.storage_path) order by pp.date desc), '[]'::jsonb)
      from (select * from public.progress_photos pp where pp.user_id = p_user_id and not pp.deleted and pp.storage_path is not null order by pp.date desc limit 12) pp));
  end if;
  return v_result;
end;
$$;

-- Weekly leaderboard of me + my friends. Values the owner does not share are NULL.
create or replace function public.friend_leaderboard(p_from date, p_to date)
returns table (user_id uuid, username text, display_name text, avatar_emoji text, is_me boolean,
               steps bigint, workouts int, volume_kg numeric, goal_completion_pct int)
language sql stable security definer set search_path = '' as $$
  with members as (
    select auth.uid() as uid
    union
    select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
    from public.friendships f
    where f.status = 'accepted' and auth.uid() in (f.requester_id, f.addressee_id)
  )
  select m.uid, p.username, p.display_name, p.avatar_emoji, m.uid = auth.uid(),
         case when m.uid = auth.uid() or pr.share_steps then st.steps_total end,
         case when m.uid = auth.uid() or pr.share_workouts then st.workouts end,
         case when m.uid = auth.uid() or pr.share_workouts then st.volume_kg end,
         case when m.uid = auth.uid() or pr.share_goal_completion then st.goal_completion_pct end
  from members m
  join public.profiles p on p.id = m.uid
  cross join lateral private.privacy_of(m.uid) pr
  cross join lateral private.period_stats(m.uid, p_from, least(p_to, p_from + 92)) st
  where auth.uid() is not null;
$$;

-- ---------------------------------------------------------------------
-- Challenges
-- ---------------------------------------------------------------------
create or replace function public.create_challenge(p_title text, p_metric text, p_start date, p_end date, p_invitees uuid[])
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_uid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.challenges (creator_id, title, metric, start_date, end_date)
  values (auth.uid(), p_title, p_metric, p_start, p_end) returning id into v_id;
  insert into public.challenge_participants (challenge_id, user_id, status, joined_at) values (v_id, auth.uid(), 'joined', now());
  foreach v_uid in array coalesce(p_invitees, '{}') loop
    if private.are_friends(auth.uid(), v_uid) and v_uid <> auth.uid() then
      insert into public.challenge_participants (challenge_id, user_id) values (v_id, v_uid) on conflict do nothing;
    end if;
  end loop;
  return v_id;
end;
$$;

create or replace function public.respond_challenge(p_challenge_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.challenge_participants
     set status = case when p_accept then 'joined' else 'declined' end,
         joined_at = case when p_accept then now() end
   where challenge_id = p_challenge_id and user_id = auth.uid();
  if not found then raise exception 'Challenge nicht gefunden'; end if;
end;
$$;

create or replace function public.list_challenges()
returns table (id uuid, title text, metric text, start_date date, end_date date, creator_name text, my_status text, participants int)
language sql stable security definer set search_path = '' as $$
  select c.id, c.title, c.metric, c.start_date, c.end_date, p.display_name, cp.status,
         (select count(*)::int from public.challenge_participants x where x.challenge_id = c.id and x.status = 'joined')
  from public.challenges c
  join public.challenge_participants cp on cp.challenge_id = c.id and cp.user_id = auth.uid()
  join public.profiles p on p.id = c.creator_id
  where cp.status <> 'declined'
  order by c.end_date desc;
$$;

create or replace function public.challenge_leaderboard(p_challenge_id uuid)
returns table (user_id uuid, display_name text, avatar_emoji text, is_me boolean, value numeric, shared boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.challenges;
begin
  if not private.is_challenge_member(p_challenge_id, auth.uid()) then raise exception 'Kein Zugriff'; end if;
  select * into c from public.challenges where id = p_challenge_id;
  return query
  select cp.user_id, p.display_name, p.avatar_emoji, cp.user_id = auth.uid(),
         case
           when not (cp.user_id = auth.uid() or case c.metric
                         when 'steps' then pr.share_steps
                         when 'workouts' then pr.share_workouts
                         when 'volume' then pr.share_workouts
                         else pr.share_goal_completion end) then null
           when c.metric = 'steps' then st.steps_total::numeric
           when c.metric = 'workouts' then st.workouts::numeric
           when c.metric = 'volume' then st.volume_kg
           when c.metric = 'protein_days' then st.protein_days_hit::numeric
           else st.goal_completion_pct::numeric
         end,
         (cp.user_id = auth.uid() or case c.metric
                         when 'steps' then pr.share_steps
                         when 'workouts' then pr.share_workouts
                         when 'volume' then pr.share_workouts
                         else pr.share_goal_completion end)
  from public.challenge_participants cp
  join public.profiles p on p.id = cp.user_id
  cross join lateral private.privacy_of(cp.user_id) pr
  cross join lateral private.period_stats(cp.user_id, c.start_date, least(c.end_date, current_date)) st
  where cp.challenge_id = p_challenge_id and cp.status = 'joined';
end;
$$;

-- ---------------------------------------------------------------------
-- Account deletion (GDPR Art. 17). Deletes the auth user; all rows cascade.
-- Storage objects are removed by the delete-account edge function first.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- Permissions: private schema functions are not callable by clients.
revoke all on schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.search_users, public.send_friend_request, public.respond_friend_request, public.remove_friend,
  public.list_friends, public.get_friend_profile, public.friend_leaderboard, public.create_challenge, public.respond_challenge,
  public.list_challenges, public.challenge_leaderboard, public.delete_my_account from public, anon;
grant execute on function public.search_users, public.send_friend_request, public.respond_friend_request, public.remove_friend,
  public.list_friends, public.get_friend_profile, public.friend_leaderboard, public.create_challenge, public.respond_challenge,
  public.list_challenges, public.challenge_leaderboard, public.delete_my_account to authenticated;

-- ---------------------------------------------------------------------
-- Storage: private progress photos bucket. Path: {user_id}/{photo_id}.jpg
-- Owner has full access; friends can read only if share_photos is enabled.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function private.can_view_photos(p_owner text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_owner = auth.uid()::text
      or (private.are_friends(auth.uid(), p_owner::uuid) and (select share_photos from private.privacy_of(p_owner::uuid)));
$$;
-- Functions used inside RLS policies run with the caller's privileges.
grant usage on schema private to authenticated;
grant execute on function private.can_view_photos(text) to authenticated;
grant execute on function private.is_challenge_member(uuid, uuid) to authenticated;

create policy "photos: owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos: owner update" on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos: owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos: owner or permitted friend read" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and private.can_view_photos((storage.foldername(name))[1]));

-- Defense in depth: the app never accesses tables as anon.
revoke all on all tables in schema public from anon;

-- ============================================================
-- 20260929000001_ai_quota.sql
-- ============================================================
-- Daily per-user counter for AI requests (edge functions call consume_ai_quota
-- before contacting Gemini). Keeps usage inside the free quota / a small budget.
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
create policy "ai_usage: read own" on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.ai_usage from anon;
revoke insert, update, delete on public.ai_usage from authenticated;

-- Atomically counts one AI request; returns false when the limit is reached.
create or replace function public.consume_ai_quota(p_limit integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.ai_usage (user_id, day, count)
  values (auth.uid(), (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
    where public.ai_usage.count < greatest(p_limit, 0)
  returning count into v_count;
  return v_count is not null and v_count <= greatest(p_limit, 0);
end;
$$;
revoke execute on function public.consume_ai_quota(integer) from public, anon;
grant execute on function public.consume_ai_quota(integer) to authenticated;

-- ============================================================
-- 20260929000002_ai_keys.sql
-- ============================================================
-- Personal Gemini API keys ("bring your own key"): every user uses Google's free
-- tier with their own key. Only ciphertext is stored (AES-GCM, secret AI_KEY_SECRET
-- known to the edge functions only), so the app never gets a usable key back.
create table public.ai_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  hint text not null,
  updated_at timestamptz not null default now()
);
alter table public.ai_keys enable row level security;
create policy "ai_keys: own rows" on public.ai_keys for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.ai_keys from anon;

-- ============================================================
-- 20260929000003_ai_limits.sql
-- ============================================================
-- Hard limits so the free Gemini quota is never exceeded:
--  * global daily cap across all users (in addition to the per-user cap)
--  * circuit breaker: when Google answers "quota exceeded", the model is blocked
--    for that key (scope = hash of the key) until the quota resets – no further calls.
create table public.ai_usage_global (
  day date primary key,
  count integer not null default 0 check (count >= 0)
);
alter table public.ai_usage_global enable row level security;
revoke all on public.ai_usage_global from anon, authenticated;

create table public.ai_model_blocks (
  scope text not null,
  model text not null,
  blocked_until timestamptz not null,
  reason text,
  primary key (scope, model)
);
alter table public.ai_model_blocks enable row level security;
revoke all on public.ai_model_blocks from anon, authenticated;

drop function if exists public.consume_ai_quota(integer);
create or replace function public.consume_ai_quota(p_limit integer, p_global_limit integer default null)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.ai_usage (user_id, day, count) values (auth.uid(), v_day, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
    where public.ai_usage.count < greatest(p_limit, 0)
  returning count into v_count;
  if v_count is null or v_count > greatest(p_limit, 0) then
    return false;
  end if;
  if p_global_limit is not null then
    v_count := null;
    insert into public.ai_usage_global (day, count) values (v_day, 1)
    on conflict (day) do update set count = public.ai_usage_global.count + 1
      where public.ai_usage_global.count < greatest(p_global_limit, 0)
    returning count into v_count;
    if v_count is null or v_count > greatest(p_global_limit, 0) then
      update public.ai_usage set count = count - 1 where user_id = auth.uid() and day = v_day;
      return false;
    end if;
  end if;
  return true;
end;
$$;
revoke execute on function public.consume_ai_quota(integer, integer) from public, anon;
grant execute on function public.consume_ai_quota(integer, integer) to authenticated;

create or replace function public.ai_model_blocked(p_scope text, p_model text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ai_model_blocks where scope = p_scope and model = p_model and blocked_until > now());
$$;

create or replace function public.block_ai_model(p_scope text, p_model text, p_seconds integer, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.ai_model_blocks (scope, model, blocked_until, reason)
  values (p_scope, p_model, now() + make_interval(secs => least(greatest(p_seconds, 1), 90000)), left(p_reason, 200))
  on conflict (scope, model) do update set blocked_until = excluded.blocked_until, reason = excluded.reason;
end;
$$;
revoke execute on function public.ai_model_blocked(text, text), public.block_ai_model(text, text, integer, text) from public, anon;
grant execute on function public.ai_model_blocked(text, text), public.block_ai_model(text, text, integer, text) to authenticated;

-- ============================================================
-- 20260929000004_presence.sql
-- ============================================================
-- "Zuletzt online" for friends/testers: the app pings touch_last_seen() while it is
-- open; friends see the time in the coach's daily briefing unless it is switched off.
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.privacy_settings add column if not exists share_online_status boolean not null default true;

create or replace function public.touch_last_seen()
returns void
language sql security definer set search_path = '' as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

create or replace function public.friends_activity()
returns table (user_id uuid, username text, display_name text, avatar_emoji text, last_seen_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name, p.avatar_emoji,
         case when coalesce(ps.share_online_status, true) then p.last_seen_at end
  from public.profiles p
  left join public.privacy_settings ps on ps.user_id = p.id and not ps.deleted
  where p.id <> auth.uid() and private.are_friends(auth.uid(), p.id)
  order by p.last_seen_at desc nulls last;
$$;

revoke execute on function public.touch_last_seen(), public.friends_activity() from public, anon;
grant execute on function public.touch_last_seen(), public.friends_activity() to authenticated;
