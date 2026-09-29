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
