begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com', '{"display_name":"Anna"}'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com', '{"display_name":"Ben"}'),
  ('33333333-3333-3333-3333-333333333333', 'cara@example.com', '{"display_name":"Cara"}');
update public.profiles set username = 'anna' where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set username = 'ben' where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set username = 'cara' where id = '33333333-3333-3333-3333-333333333333';

-- Ben's data: steps, a workout, weight; Ben does NOT share steps
insert into public.athlete_profiles (id, user_id, step_target, protein_target_g, training_days_per_week)
values ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 10000, 150, 3);
insert into public.privacy_settings (id, user_id, share_steps) values ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', false);
insert into public.step_entries (id, user_id, date, steps) values (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', current_date, 12000);
insert into public.workout_sessions (id, user_id, name, date, started_at, status)
values ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Push', current_date, now(), 'completed');
insert into public.workout_sets (id, user_id, session_id, exercise_id, weight_kg, reps, completed)
values (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001', 'bench-press', 100, 5, true);
insert into public.weight_entries (id, user_id, date, weight_kg) values (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', current_date, 90);
-- Cara is not searchable
insert into public.privacy_settings (id, user_id, searchable) values ('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', false);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select count(*)::int from public.search_users('be')), 1, 'search finds Ben');
select is((select count(*)::int from public.search_users('cara')), 0, 'non-searchable users are hidden');
select throws_ok($$select public.get_friend_profile('22222222-2222-2222-2222-222222222222')$$, 'P0001', 'Kein Zugriff', 'no profile access before friendship');

select lives_ok($$select public.send_friend_request('ben')$$, 'Anna sends request');
select is((select direction from public.list_friends() where username = 'ben'), 'outgoing', 'request is outgoing for Anna');
select throws_ok($$select public.send_friend_request('anna')$$, 'P0001', 'Du kannst dich nicht selbst hinzufügen', 'cannot add yourself');

-- Ben accepts
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select status from public.list_friends() where username = 'anna'), 'pending', 'Ben sees pending request');
select lives_ok($$select public.respond_friend_request((select request_id from public.list_friends() where username = 'anna'), true)$$, 'Ben accepts');

-- Anna views Ben
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((public.get_friend_profile('22222222-2222-2222-2222-222222222222') ->> 'week_workouts')::int, 1, 'shared workouts visible');
select is(public.get_friend_profile('22222222-2222-2222-2222-222222222222') ->> 'week_steps', null, 'unshared steps are hidden');
select ok(not (public.get_friend_profile('22222222-2222-2222-2222-222222222222') ? 'latest_weight'), 'weight private by default');
select is((select steps from public.friend_leaderboard(current_date - 6, current_date) where username = 'ben'), null::bigint, 'leaderboard hides unshared steps');
select is((select workouts from public.friend_leaderboard(current_date - 6, current_date) where username = 'ben'), 1, 'leaderboard shows shared workouts');
select is((select volume_kg from public.friend_leaderboard(current_date - 6, current_date) where username = 'ben'), 500::numeric, 'volume aggregated');
select is((select count(*)::int from public.workout_sessions), 0, 'raw rows of friends stay unreadable');

-- private challenge
select lives_ok($$select public.create_challenge('Wochen-Workouts', 'workouts', current_date - 6, current_date, array['22222222-2222-2222-2222-222222222222'::uuid, '33333333-3333-3333-3333-333333333333'::uuid])$$, 'create challenge');
select is((select participants from public.list_challenges()), 1, 'non-friends are not invited, invitee not yet joined');

select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select public.respond_challenge((select id from public.list_challenges()), true);
select is((select value from public.challenge_leaderboard((select id from public.list_challenges())) where is_me), 1::numeric, 'challenge leaderboard counts workouts');

select * from finish();
rollback;
