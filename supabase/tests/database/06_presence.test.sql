begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('a1a1a1a1-0000-0000-0000-000000000001', 'p-a@example.com'),
  ('a1a1a1a1-0000-0000-0000-000000000002', 'p-b@example.com'),
  ('a1a1a1a1-0000-0000-0000-000000000003', 'p-c@example.com');
update public.profiles set display_name = 'Pia' where id = 'a1a1a1a1-0000-0000-0000-000000000002';
insert into public.friendships (requester_id, addressee_id, status)
values ('a1a1a1a1-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-000000000002', 'accepted');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok($$select public.touch_last_seen()$$, 'B pings');

select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select display_name from public.friends_activity()), 'Pia', 'A sees friend B');
select ok((select last_seen_at from public.friends_activity()) > now() - interval '1 minute', 'with last online time');

select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select count(*)::int from public.friends_activity()), 0, 'non-friends see nothing');

-- B hides the online status
reset role;
insert into public.privacy_settings (id, user_id, share_online_status) values ('a1a1a1a1-0000-0000-0000-000000000002', 'a1a1a1a1-0000-0000-0000-000000000002', false);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a1a1a1a1-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select last_seen_at from public.friends_activity()), null, 'hidden when B switched it off');

select * from finish();
rollback;
