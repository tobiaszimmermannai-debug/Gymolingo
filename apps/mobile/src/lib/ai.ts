/**
 * AI features (Google Gemini, free tier).
 *
 * Primary mode – key on this device: the tester pastes a free Gemini key in
 * Settings → KI; the app calls Google directly (no server needed, works in local
 * mode). Hard limits: LOCAL_DAILY_LIMIT requests per day on this device, and a
 * circuit breaker that blocks a model as soon as Google reports a used-up quota.
 * Optional server mode: a shared GEMINI_API_KEY on Supabase (edge functions).
 * The key is never part of the app code.
 */
import {
  aiBodyFat,
  aiCoachReply,
  aiMealPhoto,
  aiWeeklyReportSections,
  bodyFatFacts,
  GeminiError,
  geminiCheckKey,
  looksLikeGeminiKey,
  normalizeGeminiKey,
  todayISO,
  type BodyFatResult,
  type CoachContext,
  type GeminiBlockStore,
  type MealPhotoItem,
} from '@gymolingo/core';
import { supabase } from './supabase';
import { setPrefs, useDB } from '@/data/store';
import { AI_ENABLED } from './config';

/** Requests per person (device) and day – keeps 3 testers far below Gemini's free quota. */
export const LOCAL_DAILY_LIMIT = 25;

export type AiAvailability = 'ok' | 'disabled' | 'no_key';

export function aiAvailability(): AiAvailability {
  if (!AI_ENABLED) return 'disabled';
  const s = useDB.getState();
  if (s.prefs.geminiKey || s.prefs.sharedAi?.key) return 'ok';
  if (supabase && s.accountUserId && s.prefs.aiKey?.fallback) return 'ok';
  return 'no_key';
}

/** Reactive variant for screens. */
export function useAiAvailability(): AiAvailability {
  useDB((s) => [!!s.prefs.geminiKey, !!s.prefs.sharedAi?.key, s.accountUserId, s.prefs.aiKey?.fallback].join('|'));
  return aiAvailability();
}

export class AiError extends Error {
  constructor(message: string, public code: 'not_configured' | 'no_key' | 'unavailable' | 'rate_limited' | 'failed') {
    super(message);
  }
}

// ---------------------------------------------------------------- on-device mode
const deviceStore: GeminiBlockStore = {
  async isBlocked(model) {
    const until = useDB.getState().prefs.aiBlocks?.[model];
    return !!until && until > new Date().toISOString();
  },
  async block(model, seconds) {
    const blocks = { ...(useDB.getState().prefs.aiBlocks ?? {}) };
    blocks[model] = new Date(Date.now() + seconds * 1000).toISOString();
    setPrefs({ aiBlocks: blocks });
  },
};

/** Requests used today on this device. */
export function aiUsageToday(): number {
  const u = useDB.getState().prefs.aiUsage;
  return u && u.day === todayISO() ? u.count : 0;
}

function consumeLocal(): boolean {
  const used = aiUsageToday();
  if (used >= LOCAL_DAILY_LIMIT) return false;
  setPrefs({ aiUsage: { day: todayISO(), count: used + 1 } });
  return true;
}

/** The key used on this device: own key first, otherwise the one shared by the group owner. */
export function activeGeminiKey(): string | null {
  const p = useDB.getState().prefs;
  return p.geminiKey || p.sharedAi?.key || null;
}

function deviceRun() {
  const key = activeGeminiKey();
  if (!key) return null;
  if (!consumeLocal()) throw new AiError(`Tageslimit erreicht (${LOCAL_DAILY_LIMIT} KI-Anfragen) – morgen geht es weiter.`, 'rate_limited');
  return { key, store: deviceStore };
}

function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof GeminiError) {
    if (e.code === 'rate_limited') return new AiError(e.message, 'rate_limited');
    if (e.code === 'bad_key') return new AiError('Der Gemini-Schlüssel ist ungültig – bitte in Einstellungen → KI neu eintragen.', 'no_key');
    return new AiError(e.message, e.code === 'unavailable' ? 'unavailable' : 'failed');
  }
  if (e instanceof SyntaxError) return new AiError('Die KI-Antwort war unvollständig – bitte erneut versuchen.', 'failed');
  return new AiError(e instanceof Error ? e.message : String(e), 'failed');
}

/** Checks and stores a Gemini key on this device. */
/** Google's error text in plain German where we know it. */
function explainGoogleError(message: string | undefined): string {
  if (!message) return '';
  if (/API key not valid|API_KEY_INVALID/i.test(message)) return ' Google meldet: Schlüssel ungültig. Alte Schlüssel („AIza…“) lehnt Google seit September 2026 ab – bitte in Google AI Studio einen neuen erstellen (beginnt mit „AQ.“).';
  if (/has not been used|is disabled|SERVICE_DISABLED/i.test(message)) return ' Google meldet: Die Gemini-API ist für dieses Projekt nicht aktiviert – am einfachsten einen neuen Schlüssel direkt in Google AI Studio erstellen.';
  if (/referer|referrer|restricted|blocked/i.test(message)) return ' Google meldet: Der Schlüssel ist auf andere Websites/Apps beschränkt – in der Google Cloud Console die Einschränkung entfernen oder einen neuen Schlüssel in AI Studio erstellen.';
  if (/location is not supported/i.test(message)) return ' Google meldet: Die Gemini-API ist an diesem Standort nicht verfügbar.';
  return ` Google meldet: ${message}`;
}

export async function saveDeviceKey(raw: string): Promise<void> {
  const key = normalizeGeminiKey(raw);
  if (!looksLikeGeminiKey(key)) throw new AiError('Das sieht nicht wie ein Gemini-API-Schlüssel aus. Neue Schlüssel beginnen mit „AQ.“, ältere mit „AIza“. Bitte in Google AI Studio auf „Kopieren“ tippen und hier einfügen.', 'failed');
  const check = await geminiCheckKey(key);
  if (check.result === 'invalid') throw new AiError(`Google lehnt diesen Schlüssel ab.${explainGoogleError(check.message)}`, 'failed');
  if (check.result === 'unavailable') throw new AiError(`Google ist gerade nicht erreichbar – bitte später erneut versuchen.${check.message ? ` (${check.message})` : ''}`, 'unavailable');
  setPrefs({ geminiKey: key, aiBlocks: {} });
}

export function removeDeviceKey() {
  setPrefs({ geminiKey: undefined });
}

// ---------------------------------------------------------------- key shared with friends (Supabase)
/** Loads the key the owner shared with all signed-in users. */
export async function refreshSharedKey() {
  if (!AI_ENABLED || !supabase || !useDB.getState().accountUserId) return;
  const { data, error } = await supabase.rpc('get_shared_ai_key');
  if (error) return;
  const row = Array.isArray(data) ? data[0] : null;
  setPrefs({ sharedAi: row ? { key: row.gemini_key, hint: row.hint, ownerName: row.owner_name, isOwner: row.is_owner } : null });
}

/** Shares this device's key with all signed-in users of the project. */
export async function shareKeyWithAll() {
  const key = useDB.getState().prefs.geminiKey;
  if (!supabase || !key) throw new AiError('Zuerst einen Schlüssel auf diesem Gerät speichern.', 'failed');
  if (key.length > 200) throw new AiError('Dieser Schlüssel ist zu lang für die Freigabe – bitte Claude Bescheid geben.', 'failed');
  const { error } = await supabase.rpc('set_shared_ai_key', { p_key: key });
  if (error) throw new AiError(error.message, 'failed');
  await refreshSharedKey();
}

export async function stopSharingKey() {
  if (!supabase) return;
  await supabase.rpc('clear_shared_ai_key');
  await refreshSharedKey();
}

// ---------------------------------------------------------------- server mode (optional shared key)
async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new AiError('Kein Backend konfiguriert', 'unavailable');
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let payload: { error?: string; code?: string } | null = null;
    try {
      payload = ctx ? await ctx.json() : null;
    } catch {
      payload = null;
    }
    if (payload?.code === 'not_configured') throw new AiError(payload.error ?? 'KI ist auf dem Server nicht konfiguriert.', 'not_configured');
    if (payload?.code === 'no_key') {
      setPrefs({ aiKey: { configured: false, hint: null, fallback: false } });
      throw new AiError(payload.error ?? 'Bitte hinterlege einen Gemini-Schlüssel unter Einstellungen → KI.', 'no_key');
    }
    if (ctx?.status === 429) throw new AiError(payload?.error ?? 'Das KI-Kontingent ist aufgebraucht – bitte später erneut versuchen.', 'rate_limited');
    throw new AiError(payload?.error ?? error.message ?? 'KI-Anfrage fehlgeschlagen', 'failed');
  }
  return data as T;
}

/** Asks the server whether a shared key is configured (only with an account). */
export function refreshAiKeyStatus() {
  if (!AI_ENABLED || !supabase || !useDB.getState().accountUserId) return Promise.resolve(null);
  return invoke<{ configured: boolean; hint: string | null; fallback: boolean }>('ai-key', { action: 'status' })
    .then((st) => {
      setPrefs({ aiKey: { configured: st.configured, hint: st.hint, fallback: st.fallback } });
      return st;
    })
    .catch(() => null);
}

// ---------------------------------------------------------------- tasks
export interface CoachReply {
  reply: string;
  source: 'ai' | 'rules';
  model?: string;
}

/** AI answer to a coach question, or null → the caller uses the rule-based answer. */
export async function askCoach(message: string, history: { role: 'user' | 'assistant'; content: string }[], ctx: CoachContext): Promise<CoachReply | null> {
  try {
    const run = deviceRun();
    if (run) {
      const r = await aiCoachReply(run, ctx, message, history);
      return r ? { reply: r.text, source: 'ai', model: r.model } : null;
    }
    return await invoke<CoachReply>('coach', { action: 'chat', message, history: history.slice(-10), today: todayISO() });
  } catch (e) {
    throw toAiError(e);
  }
}

export interface AiWeeklyReport {
  sections: { heading: string; body: string }[];
  source: 'ai' | 'rules';
  model?: string;
}

export async function aiWeeklyReport(weekStart: string, stats: unknown, displayName: string, goal: string): Promise<AiWeeklyReport | null> {
  try {
    const run = deviceRun();
    if (run) {
      const r = await aiWeeklyReportSections(run, stats, displayName, goal);
      return r ? { sections: r.sections, source: 'ai', model: r.model } : null;
    }
    return await invoke<AiWeeklyReport>('coach', { action: 'weekly_report', weekStart, today: todayISO() });
  } catch (e) {
    throw toAiError(e);
  }
}

export type PhotoEstimateItem = MealPhotoItem;

export async function analyzeMealPhoto(imageBase64: string, mediaType: string, hint?: string): Promise<{ items: PhotoEstimateItem[]; note: string; model?: string }> {
  try {
    const run = deviceRun();
    if (run) {
      const r = await aiMealPhoto(run, { data: imageBase64, mediaType }, hint);
      if (!r) throw new AiError('Die Analyse wurde abgelehnt. Bitte trage die Mahlzeit manuell ein.', 'failed');
      return r;
    }
    return await invoke<{ items: PhotoEstimateItem[]; note: string; model: string }>('meal-photo', { image: imageBase64, mediaType, hint });
  } catch (e) {
    throw toAiError(e);
  }
}

export type BodyFatEstimate = BodyFatResult;

/** Visual body fat estimate from 1–3 progress photos (downscaled JPEGs, base64). */
export async function estimateBodyFat(images: { data: string; mediaType: string; pose: string }[]): Promise<BodyFatEstimate> {
  try {
    const run = deviceRun();
    if (run) {
      const s = useDB.getState();
      const profile = s.tables.athlete_profiles[s.userId] ?? null;
      const latest = Object.values(s.tables.weight_entries)
        .filter((w) => !w.deleted)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      const r = await aiBodyFat(run, images, bodyFatFacts(profile, latest ? { weight_kg: latest.weight_kg, date: latest.date } : null));
      if (!r) throw new AiError('Die Fotos konnten nicht ausgewertet werden. Nutze alternativ die Berechnung aus deinen Körpermaßen.', 'failed');
      return r;
    }
    return await invoke<BodyFatEstimate>('body-fat', { images });
  } catch (e) {
    throw toAiError(e);
  }
}
