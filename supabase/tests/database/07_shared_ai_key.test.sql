begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('b1b1b1b1-0000-0000-0000-000000000001', 'k-owner@example.com', '{"display_name":"Tobi"}'),
  ('b1b1b1b1-0000-0000-0000-000000000002', 'k-friend@example.com', '{"display_name":"Lea"}'),
  ('b1b1b1b1-0000-0000-0000-000000000003', 'k-stranger@example.com', '{"display_name":"X"}');
insert into public.friendships (requester_id, addressee_id, status)
values ('b1b1b1b1-0000-0000-0000-000000000001', 'b1b1b1b1-0000-0000-0000-000000000002', 'accepted');
delete from public.shared_ai_key;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1b1b1b1-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok($$select public.set_shared_ai_key('AIzaSyOwnerKey000000000000000abcd')$$, 'owner shares the key');
select is((select is_owner from public.get_shared_ai_key()), true, 'owner sees own share');

select set_config('request.jwt.claims', '{"sub":"b1b1b1b1-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select gemini_key from public.get_shared_ai_key()), 'AIzaSyOwnerKey000000000000000abcd', 'friend receives the key');
select is((select owner_name from public.get_shared_ai_key()), 'Tobi', 'with the owner name');
select throws_ok($$select public.set_shared_ai_key('AIzaSyOtherKey000000000000000zzzz')$$, 'P0001', null, 'friend cannot overwrite it');

select set_config('request.jwt.claims', '{"sub":"b1b1b1b1-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select gemini_key from public.get_shared_ai_key()), 'AIzaSyOwnerKey000000000000000abcd', 'every signed-in user gets the key (no friendship needed)');
select throws_ok($$select * from public.shared_ai_key$$, '42501', null, 'no direct table access');

reset role;
set local role anon;
select throws_ok($$select * from public.get_shared_ai_key()$$, '42501', null, 'not without an account');

select * from finish();
rollback;
