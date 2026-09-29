/**
 * Google Gemini client for the edge functions (REST, no SDK needed).
 * Keys: each user's own free key (see userKey.ts) or an optional shared
 * GEMINI_API_KEY secret – never in the app.
 * Models (auto-updated aliases): Flash-Lite for text (large free quota),
 * Flash for photo analysis with automatic fallback to Flash-Lite.
 */
export const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-lite-latest';
export const VISION_MODEL = Deno.env.get('GEMINI_VISION_MODEL') ?? 'gemini-flash-latest';
const BASE = Deno.env.get('GEMINI_API_BASE') ?? 'https://generativelanguage.googleapis.com';

export type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
export type Turn = { role: 'user' | 'model'; parts: Part[] };

export class GeminiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: 'rate_limited' | 'bad_key' | 'bad_request' | 'unavailable',
    /** for rate limits: how long to stop calling this model, and whether it is the daily quota */
    public retryAfterSec = 60,
    public daily = false,
  ) {
    super(message);
  }
}

/** Seconds until the free quota resets (Google resets daily quotas at midnight Pacific time). */
function secondsUntilDailyReset(now = new Date()): number {
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const next = new Date(pt);
  next.setHours(24, 0, 0, 0);
  return Math.max(60, Math.round((next.getTime() - pt.getTime()) / 1000) + 60);
}

/** Reads Google's QuotaFailure / RetryInfo details of a 429 answer. */
function rateLimitInfo(details: unknown): { daily: boolean; retryAfterSec: number } {
  const text = JSON.stringify(details ?? '');
  if (/PerDay/i.test(text)) return { daily: true, retryAfterSec: secondsUntilDailyReset() };
  const m = text.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return { daily: false, retryAfterSec: m ? Math.ceil(Number(m[1])) : 60 };
}

export function geminiKey(): string | null {
  return Deno.env.get('GEMINI_API_KEY') || null;
}

/** Gemini's schema dialect is a JSON-Schema subset – drop keywords it may reject. */
function toGeminiSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(toGeminiSchema);
  if (s && typeof s === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s)) if (k !== 'additionalProperties') out[k] = toGeminiSchema(v);
    return out;
  }
  return s;
}

/**
 * One generateContent call. Returns the text (JSON text when a schema is given)
 * or `blocked: true` when the safety system declined the request.
 */
export async function generate(
  key: string,
  p: { system: string; contents: Turn[]; jsonSchema?: Record<string, unknown>; temperature?: number; maxOutputTokens?: number; timeoutMs?: number; model?: string },
): Promise<{ text: string | null; model: string; blocked: boolean }> {
  const model = p.model ?? MODEL;
  const generationConfig: Record<string, unknown> = { temperature: p.temperature ?? 0.4, maxOutputTokens: p.maxOutputTokens ?? 4096 };
  if (p.jsonSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseJsonSchema = toGeminiSchema(p.jsonSchema);
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: p.system }] }, contents: p.contents, generationConfig }),
      signal: AbortSignal.timeout(p.timeoutMs ?? 45000),
    });
  } catch (e) {
    throw new GeminiError(`KI-Dienst nicht erreichbar (${e instanceof Error ? e.name : 'Netzwerk'}).`, 502, 'unavailable');
  }
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; status?: string; details?: unknown };
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    modelVersion?: string;
  };
  if (!res.ok) {
    const msg = body.error?.message ?? res.statusText;
    if (res.status === 429) {
      const info = rateLimitInfo(body.error?.details);
      throw new GeminiError(
        info.daily ? 'Das kostenlose KI-Tageskontingent ist aufgebraucht – die KI ist bis morgen gesperrt.' : 'Das KI-Kontingent ist gerade ausgeschöpft – bitte in einer Minute erneut versuchen.',
        429,
        'rate_limited',
        info.retryAfterSec,
        info.daily,
      );
    }
    if (res.status === 401 || res.status === 403 || /API key/i.test(msg)) throw new GeminiError('Der Gemini-Schlüssel auf dem Server ist ungültig.', 503, 'bad_key');
    if (res.status === 400) throw new GeminiError(`Ungültige KI-Anfrage: ${msg}`, 400, 'bad_request');
    throw new GeminiError(`KI-Dienst nicht erreichbar (${res.status}).`, 502, 'unavailable');
  }
  const used = body.modelVersion ?? model;
  if (body.promptFeedback?.blockReason) return { text: null, model: used, blocked: true };
  const cand = body.candidates?.[0];
  const reason = cand?.finishReason ?? '';
  if (['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'IMAGE_SAFETY', 'RECITATION'].includes(reason)) return { text: null, model: used, blocked: true };
  const text = (cand?.content?.parts ?? [])
    .filter((x) => !x.thought && typeof x.text === 'string')
    .map((x) => x.text)
    .join('')
    .trim();
  return { text: text || null, model: used, blocked: false };
}

/** Checks a key with a cheap metadata request (no tokens used). */
export async function validateKey(key: string): Promise<'ok' | 'invalid' | 'unavailable'> {
  try {
    const res = await fetch(`${BASE}/v1beta/models/${encodeURIComponent(MODEL)}`, { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(15000) });
    if (res.ok || res.status === 429) return 'ok';
    if ([400, 401, 403].includes(res.status)) return 'invalid';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export function describeError(e: unknown): { status: number; message: string } {
  if (e instanceof GeminiError) return { status: e.status, message: e.message };
  if (e instanceof SyntaxError) return { status: 502, message: 'Die KI-Antwort war unvollständig.' };
  return { status: 500, message: e instanceof Error ? e.message : String(e) };
}
