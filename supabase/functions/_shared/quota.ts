/**
 * Daily limits for AI calls (keep usage inside Gemini's free quota):
 *  AI_DAILY_LIMIT (default 40) per user, AI_GLOBAL_DAILY_LIMIT (default 150) for all users together.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2';

export const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? 40);
export const GLOBAL_DAILY_LIMIT = Number(Deno.env.get('AI_GLOBAL_DAILY_LIMIT') ?? 150);

export async function consumeAiQuota(sb: SupabaseClient): Promise<boolean> {
  const { data, error } = await sb.rpc('consume_ai_quota', { p_limit: DAILY_LIMIT, p_global_limit: GLOBAL_DAILY_LIMIT });
  if (error) throw new Error(`Kontingent-Prüfung fehlgeschlagen: ${error.message}`);
  return data === true;
}
