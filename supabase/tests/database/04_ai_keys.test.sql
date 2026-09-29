begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('66666666-6666-6666-6666-666666666666', 'key-a@example.com'),
  ('77777777-7777-7777-7777-777777777777', 'key-b@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}', true);
select lives_ok($$insert into public.ai_keys (user_id, ciphertext, iv, hint) values ('66666666-6666-6666-6666-666666666666', 'x', 'y', 'abcd')$$, 'user stores own encrypted key');
select throws_ok($$insert into public.ai_keys (user_id, ciphertext, iv, hint) values ('77777777-7777-7777-7777-777777777777', 'x', 'y', 'abcd')$$, '42501', null, 'cannot store a key for someone else');

select set_config('request.jwt.claims', '{"sub":"77777777-7777-7777-7777-777777777777","role":"authenticated"}', true);
select is((select count(*)::int from public.ai_keys), 0, 'keys of other users are invisible');

reset role;
set local role anon;
select throws_ok($$select * from public.ai_keys$$, '42501', null, 'anon has no access');

select * from finish();
rollback;
