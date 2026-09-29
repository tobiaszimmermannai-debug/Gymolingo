/**
 * Daily limits for AI calls (keep usage inside Gemini's free quota):
 *  AI_DAILY_LIMIT (default 25) per user, AI_GLOBAL_DAILY_LIMIT (default 75 = 3 testers) for all users together.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2';

export const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? 25);
export const GLOBAL_DAILY_LIMIT = Number(Deno.env.get('AI_GLOBAL_DAILY_LIMIT') ?? 75);

export async function consumeAiQuota(sb: SupabaseClient): Promise<boolean> {
  const { data, error } = await sb.rpc('consume_ai_quota', { p_limit: DAILY_LIMIT, p_global_limit: GLOBAL_DAILY_LIMIT });
  if (error) throw new Error(`Kontingent-Prüfung fehlgeschlagen: ${error.message}`);
  return data === true;
}
