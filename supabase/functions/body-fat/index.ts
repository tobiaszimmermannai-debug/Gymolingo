/**
 * Estimates body fat percentage from progress photos (Gemini vision).
 * Explicitly an estimate (typical error ±3–5 percentage points): the app shows
 * a range and the user decides whether to save it. Photos are not stored here.
 */
import { describeError, type Part } from '../_shared/gemini.ts';
import { generatePhoto } from '../_shared/guard.ts';
import { resolveGeminiKey } from '../_shared/userKey.ts';
import { consumeAiQuota } from '../_shared/quota.ts';
import { json, preflight } from '../_shared/http.ts';
import { userClient } from '../_shared/userData.ts';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BASE64 = 4_000_000; // per image (~3 MB); the app sends ~1024 px JPEGs
const POSE_DE: Record<string, string> = { front: 'von vorne', side: 'seitlich', back: 'von hinten' };

const SCHEMA = {
  type: 'object',
  properties: {
    usable: { type: 'boolean' },
    body_fat_pct: { type: 'number' },
    range_low: { type: 'number' },
    range_high: { type: 'number' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    cues: { type: 'string' },
    photo_tips: { type: 'string' },
  },
  required: ['usable', 'body_fat_pct', 'range_low', 'range_high', 'confidence', 'cues', 'photo_tips'],
  additionalProperties: false,
};

const SYSTEM = `Du schätzt für eine deutsche Fitness-App den Körperfettanteil (KFA) einer erwachsenen Person anhand von Fortschrittsfotos – so, wie es ein erfahrener Coach visuell tun würde.
- Nutze sichtbare Merkmale: Definition von Bauch, Schultern, Armen und Rücken, Taillenform, Fettverteilung, Venen/Separation. Berücksichtige Geschlecht, Alter, Größe und Gewicht, falls angegeben.
- Gib einen Punktwert und eine realistische Spanne (mindestens 4 Prozentpunkte breit) an. Visuelle Schätzungen haben typischerweise ±3–5 Prozentpunkte Fehler.
- confidence: "low" bei weiter Kleidung, schlechtem Licht, ungünstigem Winkel oder nur einem Foto; "medium" im Normalfall; "high" nur bei guten, eng anliegenden Front- und Seitenfotos.
- cues: 1–2 sachliche Sätze auf Deutsch, woran du dich orientierst. Keine Bewertung des Aussehens, keine Kommentare zur Attraktivität, nicht wertend.
- photo_tips: 1 Satz, wie die nächsten Fotos vergleichbarer werden (Licht, Abstand, Pose, Kleidung).
- Wenn keine erwachsene Person erkennbar oder der Oberkörper nicht beurteilbar ist: usable=false, Werte 0 und Erklärung in cues.`;

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
  const facts = [
    profile?.sex === 'male' ? 'Geschlecht: männlich' : profile?.sex === 'female' ? 'Geschlecht: weiblich' : null,
    profile?.birth_year ? `Alter: ca. ${new Date().getFullYear() - Number(profile.birth_year)} Jahre` : null,
    profile?.height_cm ? `Größe: ${Number(profile.height_cm)} cm` : null,
    w?.weight_kg ? `Gewicht: ${Number(w.weight_kg)} kg (${w.date})` : null,
  ].filter(Boolean);

  if (!(await consumeAiQuota(sb).catch(() => false))) return json({ error: 'Tageslimit für KI-Anfragen erreicht – bitte morgen erneut versuchen.' }, 429);

  const parts: Part[] = [];
  for (const img of images) {
    parts.push({ text: `Foto ${POSE_DE[String(img.pose)] ?? ''}`.trim() });
    parts.push({ inlineData: { mimeType: String(img.mediaType ?? 'image/jpeg'), data: String(img.data) } });
  }
  parts.push({ text: facts.length ? `Angaben: ${facts.join(', ')}.` : 'Keine weiteren Angaben.' });

  try {
    const r = await generatePhoto(sb, key, { system: SYSTEM, jsonSchema: SCHEMA, temperature: 0.2, contents: [{ role: 'user', parts }] });
    if (r.blocked || !r.text) return json({ error: 'Die Fotos konnten nicht ausgewertet werden. Nutze alternativ die Berechnung aus deinen Körpermaßen.' }, 422);
    const o = JSON.parse(r.text) as Record<string, unknown>;
    const clamp = (v: unknown) => Math.round(Math.max(3, Math.min(60, Number(v) || 0)) * 10) / 10;
    if (!o.usable || !(Number(o.body_fat_pct) > 0)) return json({ usable: false, cues: String(o.cues ?? '').slice(0, 400), model: r.model });
    const est = clamp(o.body_fat_pct);
    let lo = Math.min(clamp(o.range_low), est);
    let hi = Math.max(clamp(o.range_high), est);
    if (hi - lo < 4) {
      lo = Math.max(3, Math.round((est - 2) * 10) / 10);
      hi = Math.min(60, Math.round((est + 2) * 10) / 10);
    }
    return json({
      usable: true,
      body_fat_pct: est,
      range_low: lo,
      range_high: hi,
      confidence: ['low', 'medium', 'high'].includes(String(o.confidence)) ? o.confidence : 'low',
      cues: String(o.cues ?? '').slice(0, 400),
      photo_tips: String(o.photo_tips ?? '').slice(0, 300),
      model: r.model,
    });
  } catch (e) {
    const err = describeError(e);
    return json({ error: err.message }, err.status);
  }
});
