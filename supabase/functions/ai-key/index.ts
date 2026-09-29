/**
 * Manages the user's personal Gemini API key (free tier per person).
 *  - status: is a key stored? (+ last 4 chars) and is a shared fallback key configured?
 *  - set:    validates the key with Google, stores it AES-GCM encrypted
 *  - delete: removes it
 * The key is never returned to the app.
 */
import { geminiKey, validateKey } from '../_shared/gemini.ts';
import { json, preflight } from '../_shared/http.ts';
import { userClient } from '../_shared/userData.ts';
import { encryptKey, keySecretConfigured, userGeminiKey } from '../_shared/userKey.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const sb = userClient(req);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: 'Nicht angemeldet' }, 401);
  if (!keySecretConfigured()) return json({ error: 'Persönliche KI-Schlüssel sind auf dem Server nicht eingerichtet (AI_KEY_SECRET fehlt).', code: 'not_configured' }, 501);

  let body: { action?: string; key?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ungültige Anfrage' }, 400);
  }

  const status = async () => {
    const { data } = await sb.from('ai_keys').select('hint, updated_at').eq('user_id', auth.user!.id).maybeSingle();
    const readable = data ? (await userGeminiKey(sb, auth.user!.id)) !== null : false;
    return { configured: readable, hint: readable ? data!.hint : null, updated_at: data?.updated_at ?? null, fallback: !!geminiKey() };
  };

  if (body.action === 'status') return json(await status());

  if (body.action === 'delete') {
    const { error } = await sb.from('ai_keys').delete().eq('user_id', auth.user.id);
    if (error) return json({ error: error.message }, 500);
    return json(await status());
  }

  if (body.action === 'set') {
    const key = String(body.key ?? '').trim();
    if (!/^[A-Za-z0-9_-]{20,120}$/.test(key)) return json({ error: 'Das sieht nicht wie ein Gemini-API-Schlüssel aus (beginnt meist mit „AIza…“).' }, 400);
    const check = await validateKey(key);
    if (check === 'invalid') return json({ error: 'Google lehnt diesen Schlüssel ab. Bitte in Google AI Studio prüfen und neu kopieren.' }, 400);
    if (check === 'unavailable') return json({ error: 'Google ist gerade nicht erreichbar – bitte später erneut versuchen.' }, 502);
    const { ciphertext, iv } = await encryptKey(key);
    const { error } = await sb.from('ai_keys').upsert({ user_id: auth.user.id, ciphertext, iv, hint: key.slice(-4), updated_at: new Date().toISOString() });
    if (error) return json({ error: error.message }, 500);
    return json(await status());
  }

  return json({ error: 'Unbekannte Aktion' }, 400);
});
