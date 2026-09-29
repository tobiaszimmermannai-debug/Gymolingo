-- The owner's Gemini key is used by ALL signed-in users of this project
-- (small private test group) – no friendship needed.
create or replace function public.get_shared_ai_key()
returns table (gemini_key text, hint text, owner_name text, is_owner boolean)
language sql stable security definer set search_path = '' as $$
  select k.gemini_key, k.hint, coalesce(nullif(p.display_name, ''), p.username, 'Admin'), k.owner_id = auth.uid()
  from public.shared_ai_key k
  join public.profiles p on p.id = k.owner_id
  where auth.uid() is not null;
$$;
