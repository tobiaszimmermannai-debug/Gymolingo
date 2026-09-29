/**
 * Personal Gemini keys ("bring your own key", free tier per person).
 * Stored AES-GCM encrypted in public.ai_keys; AI_KEY_SECRET exists only as an
 * edge-function secret, so neither the app nor a DB dump reveals a usable key.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2';
import { geminiKey } from './gemini.ts';

const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function keySecretConfigured(): boolean {
  return !!Deno.env.get('AI_KEY_SECRET');
}

async function aesKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('AI_KEY_SECRET');
  if (!secret) throw new Error('AI_KEY_SECRET fehlt');
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptKey(plain: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(), enc.encode(plain)));
  return { ciphertext: b64(ct), iv: b64(iv) };
}

export async function decryptKey(ciphertext: string, iv: string): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aesKey(), unb64(ciphertext));
  return new TextDecoder().decode(pt);
}

/** The user's own key, or null (not set / secret rotated / unreadable). */
export async function userGeminiKey(sb: SupabaseClient, userId: string): Promise<string | null> {
  if (!keySecretConfigured()) return null;
  const { data } = await sb.from('ai_keys').select('ciphertext, iv').eq('user_id', userId).maybeSingle();
  if (!data) return null;
  try {
    return await decryptKey(data.ciphertext, data.iv);
  } catch {
    return null;
  }
}

/** Personal key first; the optional shared server key only as fallback. */
export async function resolveGeminiKey(sb: SupabaseClient, userId: string): Promise<string | null> {
  return (await userGeminiKey(sb, userId)) ?? geminiKey();
}
