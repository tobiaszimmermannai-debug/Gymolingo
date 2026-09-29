-- One Gemini key for the whole test group: the owner stores it once in the app,
-- the owner's accepted friends receive it automatically (no setup for them).
-- Only reachable through the functions below (no direct table access).
create table public.shared_ai_key (
  id int primary key default 1 check (id = 1),
  owner_id uuid not null references auth.users (id) on delete cascade,
  gemini_key text not null check (length(gemini_key) between 20 and 200),
  hint text not null,
  updated_at timestamptz not null default now()
);
alter table public.shared_ai_key enable row level security;
revoke all on public.shared_ai_key from anon, authenticated;

create or replace function public.set_shared_ai_key(p_key text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.shared_ai_key where owner_id <> auth.uid()) then
    raise exception 'Ein anderer Nutzer hat bereits einen Schlüssel freigegeben.' using errcode = 'P0001';
  end if;
  insert into public.shared_ai_key (id, owner_id, gemini_key, hint, updated_at)
  values (1, auth.uid(), trim(p_key), right(trim(p_key), 4), now())
  on conflict (id) do update set gemini_key = excluded.gemini_key, hint = excluded.hint, updated_at = now();
end;
$$;

create or replace function public.clear_shared_ai_key()
returns void
language sql security definer set search_path = '' as $$
  delete from public.shared_ai_key where owner_id = auth.uid();
$$;

-- the owner and the owner's accepted friends get the key
create or replace function public.get_shared_ai_key()
returns table (gemini_key text, hint text, owner_name text, is_owner boolean)
language sql stable security definer set search_path = '' as $$
  select k.gemini_key, k.hint, coalesce(nullif(p.display_name, ''), p.username, 'Freund'), k.owner_id = auth.uid()
  from public.shared_ai_key k
  join public.profiles p on p.id = k.owner_id
  where auth.uid() is not null and private.are_friends(auth.uid(), k.owner_id);
$$;

revoke execute on function public.set_shared_ai_key(text), public.clear_shared_ai_key(), public.get_shared_ai_key() from public, anon;
grant execute on function public.set_shared_ai_key(text), public.clear_shared_ai_key(), public.get_shared_ai_key() to authenticated;
