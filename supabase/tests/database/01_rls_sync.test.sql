begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- two users
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com', '{"display_name":"Anna"}'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com', '{"display_name":"Ben"}');

select is((select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'Anna', 'profile row created by auth trigger');

-- act as Anna
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into public.weight_entries (id, user_id, date, weight_kg, updated_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2026-03-01', 80.5, '2026-03-01T08:00:00Z');
select is((select count(*)::int from public.weight_entries), 1, 'Anna sees her own row');

select throws_ok(
  $$insert into public.weight_entries (id, user_id, date, weight_kg) values ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '2026-03-01', 70)$$,
  '42501', null, 'cannot insert rows for another user');

-- LWW: stale update ignored, newer applied
update public.weight_entries set weight_kg = 79, updated_at = '2026-02-28T08:00:00Z' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select weight_kg from public.weight_entries where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 80.5::numeric, 'stale offline write is ignored');
update public.weight_entries set weight_kg = 79.8, updated_at = '2026-03-02T08:00:00Z' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select weight_kg from public.weight_entries where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 79.8::numeric, 'newer write wins');

-- upsert path used by the sync engine
insert into public.weight_entries (id, user_id, date, weight_kg, updated_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2026-03-01', 70, '2026-01-01T00:00:00Z')
on conflict (id) do update set weight_kg = excluded.weight_kg, updated_at = excluded.updated_at;
select is((select weight_kg from public.weight_entries where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 79.8::numeric, 'stale upsert is ignored');

select ok((select server_updated_at > '2026-01-01' from public.weight_entries where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'server_updated_at is maintained');

select throws_ok(
  $$insert into public.athlete_profiles (id, user_id) values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$$,
  '23514', null, 'athlete profile id must equal user id');

-- act as Ben: cannot read or modify Anna's data
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.weight_entries), 0, 'Ben cannot read Anna''s weights');
update public.weight_entries set weight_kg = 1, updated_at = now() + interval '1 day' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select count(*)::int from public.profiles), 1, 'Ben only sees his own profile row');

reset role;
select is((select weight_kg from public.weight_entries where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 79.8::numeric, 'Ben''s update had no effect');

-- anon has no access
set local role anon;
select throws_ok($$select count(*) from public.weight_entries$$, '42501', null, 'anon has no table access');

select * from finish();
rollback;
