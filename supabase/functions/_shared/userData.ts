/**
 * Loads the calling user's data with *their* JWT – Row Level Security
 * guarantees the function can only read the requesting user's rows.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2';
import type { UserData } from './core.mjs';

export function userClient(req: Request): SupabaseClient {
  // the app's public key (publishable or legacy anon) arrives with every request
  const apiKey = Deno.env.get('SUPABASE_ANON_KEY') || req.headers.get('apikey') || '';
  return createClient(Deno.env.get('SUPABASE_URL')!, apiKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
}

async function fetchAll(sb: SupabaseClient, table: string, since?: { column: string; value: string }): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    let q = sb.from(table).select('*').eq('deleted', false).order('id').range(from, from + page - 1);
    if (since) q = q.gte(since.column, since.value);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return out;
}

export async function loadUserData(sb: SupabaseClient, userId: string, today: string): Promise<UserData | null> {
  const since = new Date(new Date(`${today}T12:00:00Z`).getTime() - 400 * 86400000).toISOString().slice(0, 10);
  const [profiles, sessions, meals, weights, steps, checkins, pauses] = await Promise.all([
    fetchAll(sb, 'athlete_profiles'),
    fetchAll(sb, 'workout_sessions', { column: 'date', value: since }),
    fetchAll(sb, 'meal_entries', { column: 'date', value: since }),
    fetchAll(sb, 'weight_entries', { column: 'date', value: since }),
    fetchAll(sb, 'step_entries', { column: 'date', value: since }),
    fetchAll(sb, 'daily_checkins', { column: 'date', value: since }),
    fetchAll(sb, 'streak_pauses'),
  ]);
  const profile = profiles.find((p) => p.user_id === userId);
  if (!profile) return null;
  const sessionIds = new Set(sessions.map((s) => s.id));
  const sets = (await fetchAll(sb, 'workout_sets', { column: 'created_at', value: since })).filter((s) => sessionIds.has(s.session_id));
  const num = (rows: Record<string, unknown>[], keys: string[]) =>
    rows.map((r) => {
      const c = { ...r };
      for (const k of keys) if (c[k] !== null && c[k] !== undefined) c[k] = Number(c[k]);
      return c;
    });
  return {
    profile: num([profile], ['height_cm', 'start_weight_kg', 'goal_weight_kg', 'training_years', 'weekly_rate_kg'])[0],
    sessions,
    sets: num(sets, ['weight_kg', 'rir', 'rpe', 'target_weight_kg']),
    meals: num(meals, ['amount_g', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g']),
    weights: num(weights, ['weight_kg', 'body_fat_pct']),
    steps,
    checkins: num(checkins, ['sleep_hours']),
    pauses,
  } as unknown as UserData;
}
