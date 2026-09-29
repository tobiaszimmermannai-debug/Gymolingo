begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('d0d0d0d0-0000-0000-0000-000000000001', 'act@example.com');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d0d0d0d0-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok($$insert into public.cardio_sessions (id, date, activity, duration_min, kcal) values ('d0d0d0d0-1111-0000-0000-000000000001', current_date, 'soccer', 90, 1275)$$, 'catalog sport accepted');
select lives_ok($$insert into public.cardio_sessions (id, date, activity, duration_min, intensity, kcal) values ('d0d0d0d0-1111-0000-0000-000000000002', current_date, 'sex', 25, 'intense', 89)$$, 'everyday activity accepted');
select throws_ok($$insert into public.cardio_sessions (id, date, activity, duration_min) values ('d0d0d0d0-1111-0000-0000-000000000003', current_date, 'Bad Id!', 10)$$, '23514');
select ok(public.gymolingo_schema() >= 2026093003, 'schema marker');

select * from finish();
rollback;
