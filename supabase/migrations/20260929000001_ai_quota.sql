-- Daily per-user counter for AI requests (edge functions call consume_ai_quota
-- before contacting Gemini). Keeps usage inside the free quota / a small budget.
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
create policy "ai_usage: read own" on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.ai_usage from anon;
revoke insert, update, delete on public.ai_usage from authenticated;

-- Atomically counts one AI request; returns false when the limit is reached.
create or replace function public.consume_ai_quota(p_limit integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.ai_usage (user_id, day, count)
  values (auth.uid(), (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
    where public.ai_usage.count < greatest(p_limit, 0)
  returning count into v_count;
  return v_count is not null and v_count <= greatest(p_limit, 0);
end;
$$;
revoke execute on function public.consume_ai_quota(integer) from public, anon;
grant execute on function public.consume_ai_quota(integer) to authenticated;
