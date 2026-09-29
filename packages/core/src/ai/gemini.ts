/**
 * Google Gemini REST client shared by the app (on-device key) and the edge
 * functions (server key). No SDK: plain fetch, works in browsers, React Native and Deno.
 * Free tier only: when Google reports a used-up quota, callers block the model
 * (see geminiGuarded) instead of retrying – there is nothing that could cost money.
 */
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';
/** auto-updated aliases: Flash-Lite has the largest free quota, Flash sees photos better */
export const GEMINI_TEXT_MODEL = 'gemini-flash-lite-latest';
export const GEMINI_VISION_MODEL = 'gemini-flash-latest';

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
export type GeminiTurn = { role: 'user' | 'model'; parts: GeminiPart[] };

export interface GeminiConfig {
  base?: string;
  textModel?: string;
  visionModel?: string;
  fetchImpl?: typeof fetch;
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: 'rate_limited' | 'bad_key' | 'bad_request' | 'unavailable',
    /** rate limits: how long to stop calling this model, and whether the daily quota is used up */
    public retryAfterSec = 60,
    public daily = false,
  ) {
    super(message);
  }
}

/** Seconds until Google resets daily quotas (midnight Pacific time) plus a minute of margin. */
export function secondsUntilDailyReset(now = new Date()): number {
  const pt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const next = new Date(pt);
  next.setHours(24, 0, 0, 0);
  return Math.max(60, Math.round((next.getTime() - pt.getTime()) / 1000) + 60);
}

/** Reads Google's QuotaFailure / RetryInfo details of a 429 answer. */
export function rateLimitInfo(details: unknown, now = new Date()): { daily: boolean; retryAfterSec: number } {
  const text = JSON.stringify(details ?? '');
  if (/PerDay/i.test(text)) return { daily: true, retryAfterSec: secondsUntilDailyReset(now) };
  const m = text.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return { daily: false, retryAfterSec: m ? Math.ceil(Number(m[1])) : 60 };
}

/** Gemini's schema dialect is a JSON-Schema subset – drop keywords it may reject. */
export function toGeminiSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(toGeminiSchema);
  if (s && typeof s === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(s)) if (k !== 'additionalProperties') out[k] = toGeminiSchema(v);
    return out;
  }
  return s;
}

export interface GenerateParams {
  model: string;
  system: string;
  contents: GeminiTurn[];
  jsonSchema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

async function timedFetch(f: typeof fetch, url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await f(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

const BLOCK_REASONS = ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'IMAGE_SAFETY', 'RECITATION'];

/** One generateContent call. Returns the text (JSON text with a schema) or blocked=true on a safety block. */
export async function geminiGenerate(key: string, p: GenerateParams, cfg: GeminiConfig = {}): Promise<{ text: string | null; model: string; blocked: boolean }> {
  const f = cfg.fetchImpl ?? fetch;
  const generationConfig: Record<string, unknown> = { temperature: p.temperature ?? 0.4, maxOutputTokens: p.maxOutputTokens ?? 4096 };
  if (p.jsonSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseJsonSchema = toGeminiSchema(p.jsonSchema);
  }
  let res: Response;
  try {
    res = await timedFetch(
      f,
      `${cfg.base ?? GEMINI_API_BASE}/v1beta/models/${encodeURIComponent(p.model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: p.system }] }, contents: p.contents, generationConfig }),
      },
      p.timeoutMs ?? 45000,
    );
  } catch (e) {
    throw new GeminiError(`KI-Dienst nicht erreichbar (${e instanceof Error ? e.name : 'Netzwerk'}).`, 502, 'unavailable');
  }
  const body = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; details?: unknown };
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
    if (res.status === 401 || res.status === 403 || /API key/i.test(msg)) throw new GeminiError('Der Gemini-Schlüssel ist ungültig.', 503, 'bad_key');
    if (res.status === 400) throw new GeminiError(`Ungültige KI-Anfrage: ${msg}`, 400, 'bad_request');
    throw new GeminiError(`KI-Dienst nicht erreichbar (${res.status}).`, 502, 'unavailable');
  }
  const used = body.modelVersion ?? p.model;
  if (body.promptFeedback?.blockReason) return { text: null, model: used, blocked: true };
  const cand = body.candidates?.[0];
  if (BLOCK_REASONS.includes(cand?.finishReason ?? '')) return { text: null, model: used, blocked: true };
  const text = (cand?.content?.parts ?? [])
    .filter((x) => !x.thought && typeof x.text === 'string')
    .map((x) => x.text)
    .join('')
    .trim();
  return { text: text || null, model: used, blocked: false };
}

/**
 * Cleans a pasted key: removes spaces, line breaks, invisible characters and quotes.
 * Google issues "AQ.…" auth keys since 2026 (older keys start with "AIza…").
 */
export function normalizeGeminiKey(raw: string): string {
  return raw.replace(/[\s\u200B-\u200D\uFEFF"'„“”‚‘’`]/g, '');
}

export function looksLikeGeminiKey(key: string): boolean {
  return /^[A-Za-z0-9._~+/=-]{20,300}$/.test(key);
}

export interface GeminiKeyCheck {
  result: 'ok' | 'invalid' | 'unavailable';
  /** Google's own error text, if any */
  message?: string;
}

/** Checks a key with a cheap request that uses no tokens (list one model). */
export async function geminiCheckKey(key: string, cfg: GeminiConfig = {}): Promise<GeminiKeyCheck> {
  const f = cfg.fetchImpl ?? fetch;
  try {
    const res = await timedFetch(f, `${cfg.base ?? GEMINI_API_BASE}/v1beta/models?pageSize=1`, { headers: { 'x-goog-api-key': key } }, 15000);
    if (res.ok || res.status === 429) return { result: 'ok' };
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    const message = body.error?.message?.slice(0, 300);
    if ([400, 401, 403].includes(res.status)) return { result: 'invalid', message };
    return { result: 'unavailable', message: message ?? `HTTP ${res.status}` };
  } catch (e) {
    return { result: 'unavailable', message: e instanceof Error ? e.message : String(e) };
  }
}

/** Short form used by the server. */
export async function geminiValidateKey(key: string, cfg: GeminiConfig = {}): Promise<'ok' | 'invalid' | 'unavailable'> {
  return (await geminiCheckKey(key, cfg)).result;
}

/** Where blocked models are remembered (database on the server, local storage in the app). */
export interface GeminiBlockStore {
  isBlocked(model: string): Promise<boolean>;
  block(model: string, seconds: number, reason: string): Promise<void>;
}

/**
 * Tries the models in order, skipping blocked ones. A quota answer blocks that model
 * (daily quota: until reset; per-minute limit: for Google's retry delay) – Google is
 * not called again meanwhile. Throws a rate_limited GeminiError when all are blocked.
 */
export async function geminiGuarded(key: string, models: string[], p: Omit<GenerateParams, 'model'>, store: GeminiBlockStore, cfg: GeminiConfig = {}) {
  let last: GeminiError | null = null;
  for (const model of [...new Set(models)]) {
    if (await store.isBlocked(model)) continue;
    try {
      return await geminiGenerate(key, { ...p, model }, cfg);
    } catch (e) {
      if (!(e instanceof GeminiError) || e.code !== 'rate_limited') throw e;
      last = e;
      await store.block(model, e.retryAfterSec, e.daily ? 'daily quota' : 'rate limit');
    }
  }
  throw last ?? new GeminiError('Das kostenlose KI-Kontingent ist aufgebraucht – die KI ist vorübergehend gesperrt.', 429, 'rate_limited', 60, true);
}

export function describeGeminiError(e: unknown): { status: number; message: string } {
  if (e instanceof GeminiError) return { status: e.status, message: e.message };
  if (e instanceof SyntaxError) return { status: 502, message: 'Die KI-Antwort war unvollständig.' };
  return { status: 500, message: e instanceof Error ? e.message : String(e) };
}
