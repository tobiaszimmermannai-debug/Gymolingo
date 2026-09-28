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
