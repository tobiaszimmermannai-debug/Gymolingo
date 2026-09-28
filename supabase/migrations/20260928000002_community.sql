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
