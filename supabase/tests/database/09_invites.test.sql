begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('c9c9c9c9-0000-0000-0000-000000000001', 'i-a@example.com'),
  ('c9c9c9c9-0000-0000-0000-000000000002', 'i-b@example.com'),
  ('c9c9c9c9-0000-0000-0000-000000000003', 'i-c@example.com');
update public.profiles set display_name = 'Ina', avatar_emoji = '🦍' where id = 'c9c9c9c9-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c9c9c9c9-0000-0000-0000-000000000001","role":"authenticated"}', true);
create temp table codes as select public.my_invite_code() as code;
grant select on codes to anon;
select ok((select length(code) = 12 from codes), 'A gets a 12-char code');
select is(public.my_invite_code(), (select code from codes), 'code is stable');

-- anyone (even anon) can see who invites
set local role anon;
select is((select display_name || avatar_emoji from public.invite_info((select code from codes))), 'Ina🦍', 'invite info for the welcome screen');
select throws_ok($$select public.accept_invite('x')$$, '42501', null, 'anon cannot accept');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c9c9c9c9-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select display_name from public.accept_invite(upper((select code from codes)))), 'Ina', 'B accepts (case-insensitive)');
select is((select status from public.friendships), 'accepted', 'A and B are friends right away');
select lives_ok($$select public.accept_invite((select code from codes))$$, 'accepting twice is harmless');

select set_config('request.jwt.claims', '{"sub":"c9c9c9c9-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$select public.accept_invite((select code from codes))$$, '22023', null, 'own invite rejected');
select isnt(public.renew_invite_code(), (select code from codes), 'renewed code differs');

select set_config('request.jwt.claims', '{"sub":"c9c9c9c9-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok($$select public.accept_invite((select code from codes))$$, 'P0002', null, 'old link no longer works');

select * from finish();
rollback;
