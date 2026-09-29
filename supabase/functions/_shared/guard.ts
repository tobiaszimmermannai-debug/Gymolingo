/**
 * Guarded Gemini calls: models blocked after a quota answer are skipped without
 * calling Google again (circuit breaker, per key), so no free-tier limit is ever
 * pushed further – when everything is blocked, the caller falls back to rules.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2';
import { generate, GeminiError, MODEL, VISION_MODEL } from './gemini.ts';

/** Stable, non-reversible id of a key (the key itself is never stored here). */
async function scopeOf(key: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)));
  return Array.from(h.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

type Params = Omit<Parameters<typeof generate>[1], 'model'>;

async function guarded(sb: SupabaseClient, key: string, models: string[], p: Params) {
  const scope = await scopeOf(key);
  let last: GeminiError | null = null;
  for (const model of [...new Set(models)]) {
    const { data: blocked } = await sb.rpc('ai_model_blocked', { p_scope: scope, p_model: model });
    if (blocked === true) continue;
    try {
      return await generate(key, { ...p, model });
    } catch (e) {
      if (!(e instanceof GeminiError) || e.code !== 'rate_limited') throw e;
      last = e;
      await sb.rpc('block_ai_model', { p_scope: scope, p_model: model, p_seconds: e.retryAfterSec, p_reason: e.daily ? 'daily quota' : 'rate limit' });
    }
  }
  throw last ?? new GeminiError('Das kostenlose KI-Kontingent ist aufgebraucht – die KI ist vorübergehend gesperrt.', 429, 'rate_limited', 60, true);
}

/** Text (coach, weekly report): Flash-Lite only – largest free quota. */
export const generateText = (sb: SupabaseClient, key: string, p: Params) => guarded(sb, key, [MODEL], p);

/** Photos: Flash first, Flash-Lite when Flash's free quota is used up. */
export const generatePhoto = (sb: SupabaseClient, key: string, p: Params) => guarded(sb, key, [VISION_MODEL, MODEL], p);
