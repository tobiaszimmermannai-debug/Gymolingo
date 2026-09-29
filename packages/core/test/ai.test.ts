import { describe, expect, it } from 'vitest';
import { GeminiError, geminiGenerate, geminiGuarded, rateLimitInfo, type GeminiBlockStore } from '../src/ai/gemini';
import { aiBodyFat, sanitizeBodyFat, sanitizeMealItems } from '../src/ai/tasks';

type Call = { url: string; key: string; body: Record<string, any> };
function mockFetch(respond: (c: Call) => { status: number; json: unknown }) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const c = { url, key: (init.headers as Record<string, string>)['x-goog-api-key'], body: init.body ? JSON.parse(String(init.body)) : {} };
    calls.push(c);
    const r = respond(c);
    return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { f, calls };
}
const ok = (text: string) => ({ status: 200, json: { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }], modelVersion: 'mock' } });
const quota = (daily: boolean) => ({
  status: 429,
  json: { error: { code: 429, details: daily ? [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] : [{ retryDelay: '7s' }] } },
});
function memoryStore(): GeminiBlockStore & { blocks: Record<string, number> } {
  const blocks: Record<string, number> = {};
  return { blocks, isBlocked: async (m) => (blocks[m] ?? 0) > 0, block: async (m, s) => void (blocks[m] = s) };
}

describe('gemini client', () => {
  it('sends model path, key header, system instruction and a cleaned JSON schema', async () => {
    const { f, calls } = mockFetch(() => ok('{"a":1}'));
    const r = await geminiGenerate('k1', { model: 'gemini-flash-lite-latest', system: 'sys', contents: [{ role: 'user', parts: [{ text: 'hi' }] }], jsonSchema: { type: 'object', additionalProperties: false, properties: {} } }, { fetchImpl: f });
    expect(r.text).toBe('{"a":1}');
    expect(calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent');
    expect(calls[0].key).toBe('k1');
    expect(calls[0].body.systemInstruction.parts[0].text).toBe('sys');
    expect(calls[0].body.generationConfig.responseMimeType).toBe('application/json');
    expect(JSON.stringify(calls[0].body.generationConfig.responseJsonSchema)).not.toContain('additionalProperties');
  });
  it('safety block → blocked, no text', async () => {
    const { f } = mockFetch(() => ({ status: 200, json: { promptFeedback: { blockReason: 'SAFETY' } } }));
    const r = await geminiGenerate('k', { model: 'm', system: 's', contents: [] }, { fetchImpl: f });
    expect(r).toMatchObject({ text: null, blocked: true });
  });
  it('classifies quota answers: daily quota vs per-minute retry delay', () => {
    expect(rateLimitInfo([{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }]).daily).toBe(true);
    expect(rateLimitInfo([{ retryDelay: '7s' }])).toEqual({ daily: false, retryAfterSec: 7 });
    expect(rateLimitInfo(undefined)).toEqual({ daily: false, retryAfterSec: 60 });
  });
  it('guard: blocked Flash falls back to Flash-Lite and is skipped afterwards', async () => {
    const { f, calls } = mockFetch((c) => (c.url.includes('/gemini-flash-latest:') ? quota(true) : ok('x')));
    const store = memoryStore();
    await geminiGuarded('k', ['gemini-flash-latest', 'gemini-flash-lite-latest'], { system: 's', contents: [] }, store, { fetchImpl: f });
    expect(store.blocks['gemini-flash-latest']).toBeGreaterThan(60);
    await geminiGuarded('k', ['gemini-flash-latest', 'gemini-flash-lite-latest'], { system: 's', contents: [] }, store, { fetchImpl: f });
    expect(calls.map((c) => c.url.split('/models/')[1].split(':')[0])).toEqual(['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-flash-lite-latest']);
  });
  it('guard: everything blocked → rate_limited error without calling Google', async () => {
    const { f, calls } = mockFetch(() => ok('x'));
    const store = memoryStore();
    store.blocks['m'] = 100;
    await expect(geminiGuarded('k', ['m'], { system: 's', contents: [] }, store, { fetchImpl: f })).rejects.toBeInstanceOf(GeminiError);
    expect(calls).toHaveLength(0);
  });
  it('per-minute limit blocks only for the retry delay', async () => {
    const { f } = mockFetch(() => quota(false));
    const store = memoryStore();
    await expect(geminiGuarded('k', ['m'], { system: 's', contents: [] }, store, { fetchImpl: f })).rejects.toMatchObject({ code: 'rate_limited', daily: false });
    expect(store.blocks['m']).toBe(7);
  });
});

describe('ai tasks', () => {
  it('body fat: estimate kept inside a range of at least 4 points, clamped', () => {
    expect(sanitizeBodyFat({ usable: true, body_fat_pct: 18.4, range_low: 17.5, range_high: 19, confidence: 'medium', cues: 'x' })).toMatchObject({ body_fat_pct: 18.4, range_low: 16.4, range_high: 20.4 });
    expect(sanitizeBodyFat({ usable: true, body_fat_pct: 90, range_low: 1, range_high: 99, confidence: '??' })).toMatchObject({ body_fat_pct: 60, range_low: 3, range_high: 60, confidence: 'low' });
    expect(sanitizeBodyFat({ usable: false, body_fat_pct: 0, cues: 'kein Oberkörper' })).toEqual({ usable: false, cues: 'kein Oberkörper', model: undefined });
  });
  it('meal items are clamped and empty names dropped', () => {
    expect(sanitizeMealItems({ items: [{ name: 'Reis', grams: 9999, kcal: -5, protein_g: 3, carbs_g: 50, fat_g: 1, confidence: 'x' }, { name: '', grams: 10 }] })).toEqual([
      { name: 'Reis', grams: 3000, kcal: 0, protein_g: 3, carbs_g: 50, fat_g: 1, confidence: 'low' },
    ]);
  });
  it('body fat request contains labelled photos and the facts sentence', async () => {
    const { f, calls } = mockFetch(() => ok(JSON.stringify({ usable: true, body_fat_pct: 20, range_low: 17, range_high: 23, confidence: 'medium', cues: 'c', photo_tips: 't' })));
    const r = await aiBodyFat({ key: 'k', store: memoryStore(), cfg: { fetchImpl: f } }, [{ data: 'AAA', mediaType: 'image/jpeg', pose: 'side' }], 'Angaben: Größe: 180 cm.');
    expect(r?.body_fat_pct).toBe(20);
    const parts = calls[0].body.contents[0].parts;
    expect(parts[0].text).toBe('Foto seitlich');
    expect(parts[1].inlineData).toEqual({ mimeType: 'image/jpeg', data: 'AAA' });
    expect(parts[2].text).toContain('180 cm');
  });
});
