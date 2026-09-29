begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('88888888-8888-8888-8888-888888888888', 'lim-a@example.com'),
  ('99999999-9999-9999-9999-999999999999', 'lim-b@example.com');
-- isolate from other tests / earlier runs today
delete from public.ai_usage_global;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}', true);
select ok(public.consume_ai_quota(10, 2), 'A: 1st request (global 1/2)');
select ok(public.consume_ai_quota(10, 2), 'A: 2nd request (global 2/2)');
select set_config('request.jwt.claims', '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}', true);
select ok(not public.consume_ai_quota(10, 2), 'B: blocked by the global daily cap');
select is((select count from public.ai_usage where user_id = '99999999-9999-9999-9999-999999999999'), 0, 'rejected request is not counted for the user');
select throws_ok($$select * from public.ai_usage_global$$, '42501', null, 'global counter is not readable by users');

select ok(not public.ai_model_blocked('scope1', 'gemini-flash-latest'), 'model not blocked initially');
select public.block_ai_model('scope1', 'gemini-flash-latest', 3600, 'daily quota');
select ok(public.ai_model_blocked('scope1', 'gemini-flash-latest'), 'model blocked after a quota answer');
select ok(not public.ai_model_blocked('scope2', 'gemini-flash-latest'), 'blocks are per key scope');

select * from finish();
rollback;
