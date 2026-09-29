-- Invite links / QR codes: everyone has a secret invite code. Whoever opens the link
-- and signs in becomes a friend right away (sharing the link = consent). The code can
-- be renewed, which makes old links useless. Idempotent (also pasted as an update).
alter table public.profiles add column if not exists invite_code text;
create unique index if not exists profiles_invite_code_idx on public.profiles (invite_code);

create or replace function private.new_invite_code()
returns text
language sql volatile set search_path = '' as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
$$;

-- the caller's code (created on first use)
create or replace function public.my_invite_code()
returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select invite_code into v_code from public.profiles where id = auth.uid();
  if v_code is null then
    v_code := private.new_invite_code();
    update public.profiles set invite_code = v_code where id = auth.uid();
  end if;
  return v_code;
end $$;

create or replace function public.renew_invite_code()
returns text
language plpgsql security definer set search_path = '' as $$
declare v_code text := private.new_invite_code();
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  update public.profiles set invite_code = v_code where id = auth.uid();
  return v_code;
end $$;

-- who invites? (also before sign-up, for the welcome screen)
create or replace function public.invite_info(p_code text)
returns table (display_name text, avatar_emoji text, username text)
language sql stable security definer set search_path = '' as $$
  select p.display_name, p.avatar_emoji, p.username
  from public.profiles p
  where p.invite_code = lower(trim(p_code)) and length(trim(p_code)) >= 8;
$$;

-- accept: become friends with the inviter right away
create or replace function public.accept_invite(p_code text)
returns table (user_id uuid, display_name text, avatar_emoji text)
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_inviter public.profiles;
begin
  if v_me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select * into v_inviter from public.profiles p where p.invite_code = lower(trim(p_code)) and length(trim(p_code)) >= 8;
  if v_inviter.id is null then raise exception 'Einladung ungültig oder erneuert' using errcode = 'P0002'; end if;
  if v_inviter.id = v_me then raise exception 'Das ist deine eigene Einladung' using errcode = '22023'; end if;
  insert into public.friendships (requester_id, addressee_id, status, responded_at)
  values (v_inviter.id, v_me, 'accepted', now())
  on conflict (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  do update set status = 'accepted', responded_at = now();
  return query select v_inviter.id, v_inviter.display_name, v_inviter.avatar_emoji;
end $$;

revoke execute on function public.my_invite_code(), public.renew_invite_code(), public.invite_info(text), public.accept_invite(text) from public, anon;
grant execute on function public.my_invite_code(), public.renew_invite_code(), public.accept_invite(text) to authenticated;
grant execute on function public.invite_info(text) to anon, authenticated;
