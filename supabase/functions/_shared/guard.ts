/**
 * Database-backed circuit breaker for the shared Gemini client: a model that
 * reported a used-up quota is skipped (per key) until the quota resets.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2';
import { geminiConfig } from './gemini.ts';

/** Stable, non-reversible id of a key (the key itself is never stored). */
async function scopeOf(key: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)));
  return Array.from(h.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Run context for the core AI tasks (key + DB block store + server config). */
export async function aiRun(sb: SupabaseClient, key: string) {
  const scope = await scopeOf(key);
  const store = {
    async isBlocked(model: string) {
      const { data } = await sb.rpc('ai_model_blocked', { p_scope: scope, p_model: model });
      return data === true;
    },
    async block(model: string, seconds: number, reason: string) {
      await sb.rpc('block_ai_model', { p_scope: scope, p_model: model, p_seconds: seconds, p_reason: reason });
    },
  };
  return { key, store, cfg: geminiConfig };
}
