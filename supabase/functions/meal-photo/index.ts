/**
 * Estimates foods and nutrients from a meal photo (Gemini vision).
 * The result is explicitly an estimate – the app stores it with is_estimate = true
 * and lets the user correct amounts. The photo is not stored.
 */
import { aiMealPhoto } from '../_shared/core.mjs';
import { describeError } from '../_shared/gemini.ts';
import { aiRun } from '../_shared/guard.ts';
import { resolveGeminiKey } from '../_shared/userKey.ts';
import { consumeAiQuota } from '../_shared/quota.ts';
import { json, preflight } from '../_shared/http.ts';
import { userClient } from '../_shared/userData.ts';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BASE64 = 6_000_000; // ~4.5 MB image

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const sb = userClient(req);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return json({ error: 'Nicht angemeldet' }, 401);

  const key = await resolveGeminiKey(sb, auth.user.id);
  if (!key) return json({ error: 'Hinterlege deinen kostenlosen Gemini-Schlüssel unter Einstellungen → KI.', code: 'no_key' }, 501);

  let body: { image?: string; mediaType?: string; hint?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Ungültige Anfrage' }, 400);
  }
  const image = String(body.image ?? '');
  const mediaType = String(body.mediaType ?? 'image/jpeg');
  if (!image || image.length > MAX_BASE64) return json({ error: 'Bild fehlt oder ist zu groß (max. ca. 4,5 MB).' }, 413);
  if (!ALLOWED.includes(mediaType)) return json({ error: 'Nicht unterstütztes Bildformat.' }, 415);

  if (!(await consumeAiQuota(sb).catch(() => false))) return json({ error: 'Tageslimit für KI-Anfragen erreicht – bitte morgen wieder oder manuell eintragen.' }, 429);

  try {
    const r = await aiMealPhoto(await aiRun(sb, key), { data: image, mediaType }, body.hint ? String(body.hint) : undefined);
    if (!r) return json({ error: 'Die Analyse wurde abgelehnt. Bitte trage die Mahlzeit manuell ein.' }, 422);
    return json(r);
  } catch (e) {
    const err = describeError(e);
    return json({ error: err.message }, err.status);
  }
});
