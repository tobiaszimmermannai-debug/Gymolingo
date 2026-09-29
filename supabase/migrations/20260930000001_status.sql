-- Fun status messages ("🥤 Monster Zero White intus"): one emoji + short text on the
-- profile, optionally expiring. Friends see it in the daily briefing and the community.
-- Idempotent, so it can also be pasted into an existing project as an update.
alter table public.profiles add column if not exists status_emoji text;
alter table public.profiles add column if not exists status_text text;
alter table public.profiles add column if not exists status_until timestamptz;

do $$ begin
  alter table public.profiles add constraint profiles_status_len
    check (char_length(status_emoji) <= 16 and char_length(status_text) <= 80);
exception when duplicate_object then null;
end $$;

create or replace function public.set_status(p_emoji text, p_text text, p_until timestamptz default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  update public.profiles
  set status_emoji = nullif(left(trim(coalesce(p_emoji, '')), 16), ''),
      status_text = nullif(left(trim(coalesce(p_text, '')), 80), ''),
      status_until = case when nullif(trim(coalesce(p_emoji, '')), '') is null then null else p_until end,
      updated_at = now()
  where id = auth.uid();
end $$;

-- The return type changes, so the old function has to go first.
drop function if exists public.friends_activity();
create function public.friends_activity()
returns table (user_id uuid, username text, display_name text, avatar_emoji text, last_seen_at timestamptz, status_emoji text, status_text text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name, p.avatar_emoji,
         case when coalesce(ps.share_online_status, true) then p.last_seen_at end,
         case when p.status_until is null or p.status_until > now() then p.status_emoji end,
         case when p.status_until is null or p.status_until > now() then p.status_text end
  from public.profiles p
  left join public.privacy_settings ps on ps.user_id = p.id and not ps.deleted
  where p.id <> auth.uid() and private.are_friends(auth.uid(), p.id)
  order by p.last_seen_at desc nulls last;
$$;

revoke execute on function public.set_status(text, text, timestamptz), public.friends_activity() from public, anon;
grant execute on function public.set_status(text, text, timestamptz), public.friends_activity() to authenticated;
