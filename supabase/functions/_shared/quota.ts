/**
 * Per-user daily limit for AI calls (protects the Gemini quota / budget).
 * AI_DAILY_LIMIT (default 30) counts every AI request of a user per UTC day.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2';

export const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? 30);

export async function consumeAiQuota(sb: SupabaseClient): Promise<boolean> {
  const { data, error } = await sb.rpc('consume_ai_quota', { p_limit: DAILY_LIMIT });
  if (error) throw new Error(`Kontingent-Prüfung fehlgeschlagen: ${error.message}`);
  return data === true;
}
