begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('b8b8b8b8-0000-0000-0000-000000000001', 's-a@example.com'),
  ('b8b8b8b8-0000-0000-0000-000000000002', 's-b@example.com'),
  ('b8b8b8b8-0000-0000-0000-000000000003', 's-c@example.com');
insert into public.friendships (requester_id, addressee_id, status)
values ('b8b8b8b8-0000-0000-0000-000000000001', 'b8b8b8b8-0000-0000-0000-000000000002', 'accepted');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b8b8b8b8-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$select public.set_status('🥤', '  Monster Zero White intus  ', null)$$, 'B sets a status');

select set_config('request.jwt.claims', '{"sub":"b8b8b8b8-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select status_emoji || ' ' || status_text from public.friends_activity()), '🥤 Monster Zero White intus', 'friend A sees it (trimmed)');

select set_config('request.jwt.claims', '{"sub":"b8b8b8b8-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select count(*)::int from public.friends_activity()), 0, 'non-friends see nothing');

-- long texts are cut to 80 characters
select set_config('request.jwt.claims', '{"sub":"b8b8b8b8-0000-0000-0000-000000000002","role":"authenticated"}', true);
select public.set_status('⚡', repeat('x', 200), null);
reset role;
select is((select char_length(status_text) from public.profiles where id = 'b8b8b8b8-0000-0000-0000-000000000002'), 80, 'text capped at 80');

-- an expired status is hidden
set local role authenticated;
select public.set_status('😴', 'Rest Day', now() - interval '1 minute');
select set_config('request.jwt.claims', '{"sub":"b8b8b8b8-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select status_emoji from public.friends_activity()), null, 'expired status hidden');

-- clearing
select set_config('request.jwt.claims', '{"sub":"b8b8b8b8-0000-0000-0000-000000000002","role":"authenticated"}', true);
select public.set_status(null, null, null);
select set_config('request.jwt.claims', '{"sub":"b8b8b8b8-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select status_text from public.friends_activity()), null, 'cleared status');

-- anonymous callers cannot set a status
set local role anon;
select throws_ok($$select public.set_status('x', 'y', null)$$, '42501');

select * from finish();
rollback;
