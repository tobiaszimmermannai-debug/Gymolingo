/**
 * Estimates body fat percentage from progress photos (Gemini vision).
 * Explicitly an estimate (typical error ±3–5 percentage points): the app shows
 * a range and the user decides whether to save it. Photos are not stored here.
 */
import { aiBodyFat, bodyFatFacts } from '../_shared/core.mjs';
import { describeError } from '../_shared/gemini.ts';
import { aiRun } from '../_shared/guard.ts';
import { resolveGeminiKey } from '../_shared/userKey.ts';
import { consumeAiQuota } from '../_shared/quota.ts';
import { json, preflight } from '../_shared/http.ts';
import { userClient } from '../_shared/userData.ts';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BASE64 = 4_000_000; // per image (~3 MB); the app sends ~1024 px JPEGs
Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const sb = userClient(req);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: 'Nicht angemeldet' }, 401);

  const key = await resolveGeminiKey(sb, auth.user.id);
  if (!key) return json({ error: 'Hinterlege deinen kostenlosen Gemini-Schlüssel unter Einstellungen → KI.', code: 'no_key' }, 501);

  let body: { images?: { data?: string; mediaType?: string; pose?: string }[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ungültige Anfrage' }, 400);
  }
  const images = (body.images ?? []).slice(0, 3);
  if (!images.length) return json({ error: 'Bitte mindestens ein Foto senden.' }, 400);
  for (const img of images) {
    if (!img.data || img.data.length > MAX_BASE64) return json({ error: 'Foto fehlt oder ist zu groß.' }, 413);
    if (!ALLOWED.includes(String(img.mediaType ?? 'image/jpeg'))) return json({ error: 'Nicht unterstütztes Bildformat.' }, 415);
  }

  // context from the user's own profile (RLS) – never trusted from the request
  const { data: profile } = await sb.from('athlete_profiles').select('sex, birth_year, height_cm').eq('user_id', auth.user.id).maybeSingle();
  const { data: w } = await sb.from('weight_entries').select('weight_kg, date').eq('deleted', false).order('date', { ascending: false }).limit(1).maybeSingle();
  const facts = bodyFatFacts(profile ?? null, w ? { weight_kg: Number(w.weight_kg), date: w.date } : null);

  if (!(await consumeAiQuota(sb).catch(() => false))) return json({ error: 'Tageslimit für KI-Anfragen erreicht – bitte morgen erneut versuchen.' }, 429);

  try {
    const r = await aiBodyFat(
      await aiRun(sb, key),
      images.map((i) => ({ data: String(i.data), mediaType: String(i.mediaType ?? 'image/jpeg'), pose: String(i.pose ?? '') })),
      facts,
    );
    if (!r) return json({ error: 'Die Fotos konnten nicht ausgewertet werden. Nutze alternativ die Berechnung aus deinen Körpermaßen.' }, 422);
    return json(r);
  } catch (e) {
    const err = describeError(e);
    return json({ error: err.message }, err.status);
  }
});
