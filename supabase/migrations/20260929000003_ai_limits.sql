-- Hard limits so the free Gemini quota is never exceeded:
--  * global daily cap across all users (in addition to the per-user cap)
--  * circuit breaker: when Google answers "quota exceeded", the model is blocked
--    for that key (scope = hash of the key) until the quota resets – no further calls.
create table public.ai_usage_global (
  day date primary key,
  count integer not null default 0 check (count >= 0)
);
alter table public.ai_usage_global enable row level security;
revoke all on public.ai_usage_global from anon, authenticated;

create table public.ai_model_blocks (
  scope text not null,
  model text not null,
  blocked_until timestamptz not null,
  reason text,
  primary key (scope, model)
);
alter table public.ai_model_blocks enable row level security;
revoke all on public.ai_model_blocks from anon, authenticated;

drop function if exists public.consume_ai_quota(integer);
create or replace function public.consume_ai_quota(p_limit integer, p_global_limit integer default null)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.ai_usage (user_id, day, count) values (auth.uid(), v_day, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
    where public.ai_usage.count < greatest(p_limit, 0)
  returning count into v_count;
  if v_count is null or v_count > greatest(p_limit, 0) then
    return false;
  end if;
  if p_global_limit is not null then
    v_count := null;
    insert into public.ai_usage_global (day, count) values (v_day, 1)
    on conflict (day) do update set count = public.ai_usage_global.count + 1
      where public.ai_usage_global.count < greatest(p_global_limit, 0)
    returning count into v_count;
    if v_count is null or v_count > greatest(p_global_limit, 0) then
      update public.ai_usage set count = count - 1 where user_id = auth.uid() and day = v_day;
      return false;
    end if;
  end if;
  return true;
end;
$$;
revoke execute on function public.consume_ai_quota(integer, integer) from public, anon;
grant execute on function public.consume_ai_quota(integer, integer) to authenticated;

create or replace function public.ai_model_blocked(p_scope text, p_model text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.ai_model_blocks where scope = p_scope and model = p_model and blocked_until > now());
$$;

create or replace function public.block_ai_model(p_scope text, p_model text, p_seconds integer, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.ai_model_blocks (scope, model, blocked_until, reason)
  values (p_scope, p_model, now() + make_interval(secs => least(greatest(p_seconds, 1), 90000)), left(p_reason, 200))
  on conflict (scope, model) do update set blocked_until = excluded.blocked_until, reason = excluded.reason;
end;
$$;
revoke execute on function public.ai_model_blocked(text, text), public.block_ai_model(text, text, integer, text) from public, anon;
grant execute on function public.ai_model_blocked(text, text), public.block_ai_model(text, text, integer, text) to authenticated;
