begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'quota-a@example.com'),
  ('55555555-5555-5555-5555-555555555555', 'quota-b@example.com');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select ok(public.consume_ai_quota(2), '1st request within limit');
select ok(public.consume_ai_quota(2), '2nd request within limit');
select ok(not public.consume_ai_quota(2), '3rd request is rejected');
select is((select count from public.ai_usage), 2, 'counter stops at the limit');
select throws_ok($$insert into public.ai_usage (user_id, count) values ('44444444-4444-4444-4444-444444444444', 0)$$, '42501', null, 'users cannot write the counter directly');

select set_config('request.jwt.claims', '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
select is((select count(*)::int from public.ai_usage), 0, 'users only see their own usage');

reset role;
set local role anon;
select throws_ok($$select public.consume_ai_quota(5)$$, '42501', null, 'anon cannot consume quota');

select * from finish();
rollback;
