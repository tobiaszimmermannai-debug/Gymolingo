-- Personal Gemini API keys ("bring your own key"): every user uses Google's free
-- tier with their own key. Only ciphertext is stored (AES-GCM, secret AI_KEY_SECRET
-- known to the edge functions only), so the app never gets a usable key back.
create table public.ai_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  hint text not null,
  updated_at timestamptz not null default now()
);
alter table public.ai_keys enable row level security;
create policy "ai_keys: own rows" on public.ai_keys for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.ai_keys from anon;
