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
