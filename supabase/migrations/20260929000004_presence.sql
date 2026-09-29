-- "Zuletzt online" for friends/testers: the app pings touch_last_seen() while it is
-- open; friends see the time in the coach's daily briefing unless it is switched off.
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.privacy_settings add column if not exists share_online_status boolean not null default true;

create or replace function public.touch_last_seen()
returns void
language sql security definer set search_path = '' as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

create or replace function public.friends_activity()
returns table (user_id uuid, username text, display_name text, avatar_emoji text, last_seen_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.username, p.display_name, p.avatar_emoji,
         case when coalesce(ps.share_online_status, true) then p.last_seen_at end
  from public.profiles p
  left join public.privacy_settings ps on ps.user_id = p.id and not ps.deleted
  where p.id <> auth.uid() and private.are_friends(auth.uid(), p.id)
  order by p.last_seen_at desc nulls last;
$$;

revoke execute on function public.touch_last_seen(), public.friends_activity() from public, anon;
grant execute on function public.touch_last_seen(), public.friends_activity() to authenticated;
