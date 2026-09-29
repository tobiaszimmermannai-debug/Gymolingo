/**
 * Estimates foods and nutrients from a meal photo (Gemini vision).
 * The result is explicitly an estimate – the app stores it with is_estimate = true
 * and lets the user correct amounts. The photo is not stored.
 */
import { describeError } from '../_shared/gemini.ts';
import { generatePhoto } from '../_shared/guard.ts';
import { resolveGeminiKey } from '../_shared/userKey.ts';
import { consumeAiQuota } from '../_shared/quota.ts';
import { json, preflight } from '../_shared/http.ts';
import { userClient } from '../_shared/userData.ts';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BASE64 = 6_000_000; // ~4.5 MB image

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          fat_g: { type: 'number' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        },
        required: ['name', 'grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g', 'confidence'],
        additionalProperties: false,
      },
    },
    note: { type: 'string' },
  },
  required: ['items', 'note'],
  additionalProperties: false,
};

const SYSTEM = `Du schätzt Lebensmittel und Nährwerte auf Fotos von Mahlzeiten für eine deutsche Fitness-App.
- Erkenne die einzelnen Komponenten (deutsche Bezeichnungen) und schätze das Gewicht in Gramm.
- Nährwerte (kcal, Protein, Kohlenhydrate, Fett) für die geschätzte Menge, orientiert an typischen deutschen Durchschnittswerten.
- confidence: "low" bei verdeckten Zutaten/unklaren Mengen, "medium" im Normalfall, "high" nur bei eindeutig erkennbaren, portionierten Lebensmitteln.
- Berücksichtige typisches Bratfett/Soßen, wenn sichtbar, und erwähne Unsicherheiten kurz in "note" (Deutsch, 1–2 Sätze).
- Wenn kein Essen erkennbar ist: leere items-Liste und Erklärung in "note".`;

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
    const r = await generatePhoto(sb, key, {
      system: SYSTEM,
      jsonSchema: SCHEMA,
      temperature: 0.2,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: mediaType, data: image } },
            { text: body.hint ? `Hinweis des Nutzers: ${String(body.hint).slice(0, 300)}` : 'Bitte analysiere diese Mahlzeit.' },
          ],
        },
      ],
    });
    if (r.blocked || !r.text) return json({ error: 'Die Analyse wurde abgelehnt. Bitte trage die Mahlzeit manuell ein.' }, 422);
    const parsed = JSON.parse(r.text) as { items: Record<string, unknown>[]; note: string };
    const items = parsed.items
      .map((i) => ({
        name: String(i.name).slice(0, 120),
        grams: Math.max(1, Math.min(3000, Number(i.grams) || 0)),
        kcal: Math.max(0, Math.min(5000, Number(i.kcal) || 0)),
        protein_g: Math.max(0, Number(i.protein_g) || 0),
        carbs_g: Math.max(0, Number(i.carbs_g) || 0),
        fat_g: Math.max(0, Number(i.fat_g) || 0),
        confidence: ['low', 'medium', 'high'].includes(String(i.confidence)) ? i.confidence : 'low',
      }))
      .filter((i) => i.name && i.grams > 0);
    return json({ items, note: parsed.note ?? '', model: r.model });
  } catch (e) {
    const err = describeError(e);
    return json({ error: err.message }, err.status);
  }
});
