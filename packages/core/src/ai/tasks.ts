/**
 * The AI tasks of the app (coach chat, weekly report, meal photo, body fat from photos):
 * prompts, JSON schemas, request building and sanitising – shared by the app and the edge functions.
 * All numbers come from the deterministic core; the model only interprets or estimates.
 */
import type { AthleteProfile } from '../types';
import { buildCoachUserMessage, COACH_SYSTEM_PROMPT, WEEKLY_REPORT_PROMPT, type CoachContext } from '../coach/context';
import { GEMINI_FALLBACK_MODELS, GEMINI_TEXT_MODEL, GEMINI_VISION_MODEL, geminiGuarded, type GeminiBlockStore, type GeminiConfig, type GeminiPart, type GeminiTurn } from './gemini';

export const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: { heading: { type: 'string' }, body: { type: 'string' } },
        required: ['heading', 'body'],
        additionalProperties: false,
      },
    },
  },
  required: ['sections'],
  additionalProperties: false,
};

export const MEAL_PHOTO_SCHEMA = {
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

export const MEAL_PHOTO_SYSTEM = `Du schätzt Lebensmittel und Nährwerte auf Fotos von Mahlzeiten für eine deutsche Fitness-App.
- Erkenne die einzelnen Komponenten (deutsche Bezeichnungen) und schätze das Gewicht in Gramm.
- Nährwerte (kcal, Protein, Kohlenhydrate, Fett) für die geschätzte Menge, orientiert an typischen deutschen Durchschnittswerten.
- confidence: "low" bei verdeckten Zutaten/unklaren Mengen, "medium" im Normalfall, "high" nur bei eindeutig erkennbaren, portionierten Lebensmitteln.
- Berücksichtige typisches Bratfett/Soßen, wenn sichtbar, und erwähne Unsicherheiten kurz in "note" (Deutsch, 1–2 Sätze).
- Wenn kein Essen erkennbar ist: leere items-Liste und Erklärung in "note".`;

export const BODY_FAT_SCHEMA = {
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

export const BODY_FAT_SYSTEM = `Du schätzt für eine deutsche Fitness-App den Körperfettanteil (KFA) einer erwachsenen Person anhand von Fortschrittsfotos – so, wie es ein erfahrener Coach visuell tun würde.
- Nutze sichtbare Merkmale: Definition von Bauch, Schultern, Armen und Rücken, Taillenform, Fettverteilung, Venen/Separation. Berücksichtige Geschlecht, Alter, Größe und Gewicht, falls angegeben.
- Gib einen Punktwert und eine realistische Spanne (mindestens 4 Prozentpunkte breit) an. Visuelle Schätzungen haben typischerweise ±3–5 Prozentpunkte Fehler.
- confidence: "low" bei weiter Kleidung, schlechtem Licht, ungünstigem Winkel oder nur einem Foto; "medium" im Normalfall; "high" nur bei guten, eng anliegenden Front- und Seitenfotos.
- cues: 1–2 sachliche Sätze auf Deutsch, woran du dich orientierst. Keine Bewertung des Aussehens, keine Kommentare zur Attraktivität, nicht wertend.
- photo_tips: 1 Satz, wie die nächsten Fotos vergleichbarer werden (Licht, Abstand, Pose, Kleidung).
- Wenn keine erwachsene Person erkennbar oder der Oberkörper nicht beurteilbar ist: usable=false, Werte 0 und Erklärung in cues.`;

const POSE_DE: Record<string, string> = { front: 'von vorne', side: 'seitlich', back: 'von hinten' };

export interface MealPhotoItem {
  name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface BodyFatResult {
  usable: boolean;
  body_fat_pct?: number;
  range_low?: number;
  range_high?: number;
  confidence?: 'low' | 'medium' | 'high';
  cues: string;
  photo_tips?: string;
  model?: string;
}

const conf = (v: unknown): 'low' | 'medium' | 'high' => (['low', 'medium', 'high'].includes(String(v)) ? (v as 'low') : 'low');

export function sanitizeMealItems(parsed: { items?: Record<string, unknown>[] }): MealPhotoItem[] {
  return (parsed.items ?? [])
    .map((i) => ({
      name: String(i.name ?? '').slice(0, 120),
      grams: Math.max(1, Math.min(3000, Number(i.grams) || 0)),
      kcal: Math.max(0, Math.min(5000, Number(i.kcal) || 0)),
      protein_g: Math.max(0, Number(i.protein_g) || 0),
      carbs_g: Math.max(0, Number(i.carbs_g) || 0),
      fat_g: Math.max(0, Number(i.fat_g) || 0),
      confidence: conf(i.confidence),
    }))
    .filter((i) => i.name && i.grams > 0);
}

/** Clamps to 3–60 %, keeps the estimate inside its range and widens ranges below 4 points. */
export function sanitizeBodyFat(o: Record<string, unknown>, model?: string): BodyFatResult {
  const clamp = (v: unknown) => Math.round(Math.max(3, Math.min(60, Number(v) || 0)) * 10) / 10;
  if (!o.usable || !(Number(o.body_fat_pct) > 0)) return { usable: false, cues: String(o.cues ?? '').slice(0, 400), model };
  const est = clamp(o.body_fat_pct);
  let lo = Math.min(clamp(o.range_low), est);
  let hi = Math.max(clamp(o.range_high), est);
  if (hi - lo < 4) {
    lo = Math.max(3, Math.round((est - 2) * 10) / 10);
    hi = Math.min(60, Math.round((est + 2) * 10) / 10);
  }
  return {
    usable: true,
    body_fat_pct: est,
    range_low: lo,
    range_high: hi,
    confidence: conf(o.confidence),
    cues: String(o.cues ?? '').slice(0, 400),
    photo_tips: String(o.photo_tips ?? '').slice(0, 300),
    model,
  };
}

/** Context sentence for the body fat estimate (sex, age, height, latest weight). */
export function bodyFatFacts(profile: Pick<AthleteProfile, 'sex' | 'birth_year' | 'height_cm'> | null, latest: { weight_kg: number; date: string } | null, year = new Date().getFullYear()): string {
  const facts = [
    profile?.sex === 'male' ? 'Geschlecht: männlich' : profile?.sex === 'female' ? 'Geschlecht: weiblich' : null,
    profile?.birth_year ? `Alter: ca. ${year - Number(profile.birth_year)} Jahre` : null,
    profile?.height_cm ? `Größe: ${Number(profile.height_cm)} cm` : null,
    latest?.weight_kg ? `Gewicht: ${Number(latest.weight_kg)} kg (${latest.date})` : null,
  ].filter(Boolean);
  return facts.length ? `Angaben: ${facts.join(', ')}.` : 'Keine weiteren Angaben.';
}

// ---------------------------------------------------------------- task runners (throw GeminiError; callers fall back to rules)
type Run = { key: string; store: GeminiBlockStore; cfg?: GeminiConfig };
/** Flash-Lite first (largest free quota); Flash only when Lite is overloaded or blocked */
const textModels = (cfg?: GeminiConfig) => [cfg?.textModel ?? GEMINI_TEXT_MODEL, cfg?.visionModel ?? GEMINI_VISION_MODEL, ...(cfg?.fallbackModels ?? GEMINI_FALLBACK_MODELS)];
const photoModels = (cfg?: GeminiConfig) => [cfg?.visionModel ?? GEMINI_VISION_MODEL, cfg?.textModel ?? GEMINI_TEXT_MODEL, ...(cfg?.fallbackModels ?? GEMINI_FALLBACK_MODELS)];

/** Coach answer; null when the safety system declined (→ rule-based answer). */
export async function aiCoachReply(r: Run, ctx: CoachContext, question: string, history: { role: string; content: string }[]): Promise<{ text: string; model: string } | null> {
  const turns: GeminiTurn[] = history
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-10)
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content.slice(0, 4000) }] }));
  while (turns.length && turns[0].role !== 'user') turns.shift();
  const res = await geminiGuarded(r.key, textModels(r.cfg), { system: COACH_SYSTEM_PROMPT, contents: [...turns, { role: 'user', parts: [{ text: buildCoachUserMessage(ctx, question.slice(0, 2000)) }] }], temperature: 0.5 }, r.store, r.cfg, { quotaFallback: false });
  return res.blocked || !res.text ? null : { text: res.text, model: res.model };
}

/** AI wording of the weekly report; null when declined or incomplete. */
export async function aiWeeklyReportSections(r: Run, stats: unknown, displayName: string, goal: string): Promise<{ sections: { heading: string; body: string }[]; model: string } | null> {
  const res = await geminiGuarded(
    r.key,
    textModels(r.cfg),
    {
      system: `${COACH_SYSTEM_PROMPT}\n\n${WEEKLY_REPORT_PROMPT}`,
      contents: [{ role: 'user', parts: [{ text: `<wochenstatistik>\n${JSON.stringify(stats)}\n</wochenstatistik>\n\nNutzer: ${displayName || 'Athlet'}, Ziel: ${goal}.` }] }],
      jsonSchema: REPORT_SCHEMA,
      temperature: 0.4,
      maxOutputTokens: 8192,
    },
    r.store,
    r.cfg,
    { quotaFallback: false },
  );
  if (res.blocked || !res.text) return null;
  const parsed = JSON.parse(res.text) as { sections?: { heading: string; body: string }[] };
  if (!Array.isArray(parsed.sections) || parsed.sections.length < 3) return null;
  return { sections: parsed.sections.map((s) => ({ heading: String(s.heading).slice(0, 120), body: String(s.body).slice(0, 2000) })), model: res.model };
}

export async function aiMealPhoto(r: Run, image: { data: string; mediaType: string }, hint?: string): Promise<{ items: MealPhotoItem[]; note: string; model: string } | null> {
  const parts: GeminiPart[] = [{ inlineData: { mimeType: image.mediaType, data: image.data } }, { text: hint ? `Hinweis des Nutzers: ${hint.slice(0, 300)}` : 'Bitte analysiere diese Mahlzeit.' }];
  const res = await geminiGuarded(r.key, photoModels(r.cfg), { system: MEAL_PHOTO_SYSTEM, jsonSchema: MEAL_PHOTO_SCHEMA, temperature: 0.2, contents: [{ role: 'user', parts }] }, r.store, r.cfg);
  if (res.blocked || !res.text) return null;
  const parsed = JSON.parse(res.text) as { items?: Record<string, unknown>[]; note?: string };
  return { items: sanitizeMealItems(parsed), note: String(parsed.note ?? ''), model: res.model };
}

export async function aiBodyFat(r: Run, images: { data: string; mediaType: string; pose: string }[], facts: string): Promise<BodyFatResult | null> {
  const parts: GeminiPart[] = [];
  for (const img of images.slice(0, 3)) {
    parts.push({ text: `Foto ${POSE_DE[img.pose] ?? ''}`.trim() });
    parts.push({ inlineData: { mimeType: img.mediaType, data: img.data } });
  }
  parts.push({ text: facts });
  const res = await geminiGuarded(r.key, photoModels(r.cfg), { system: BODY_FAT_SYSTEM, jsonSchema: BODY_FAT_SCHEMA, temperature: 0.2, contents: [{ role: 'user', parts }] }, r.store, r.cfg);
  if (res.blocked || !res.text) return null;
  return sanitizeBodyFat(JSON.parse(res.text) as Record<string, unknown>, res.model);
}
