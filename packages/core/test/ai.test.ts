import { describe, expect, it } from 'vitest';
import { GeminiError, geminiGenerate, geminiGuarded, rateLimitInfo, type GeminiBlockStore } from '../src/ai/gemini';
import { aiBodyFat, aiMealPhoto, sanitizeBodyFat, sanitizeMealItems } from '../src/ai/tasks';

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

describe('gemini overload (503 "high demand")', () => {
  const busy = { status: 503, json: { error: { code: 503, message: 'This model is currently experiencing high demand.', status: 'UNAVAILABLE' } } };
  const cfg = (f: typeof fetch) => ({ fetchImpl: f, retryDelaysMs: [0, 0] });
  const model = (c: Call) => c.url.split('/models/')[1].split(':')[0];

  it('retries the same model when Google is briefly overloaded', async () => {
    let n = 0;
    const { f, calls } = mockFetch(() => (++n < 3 ? busy : ok('x')));
    const r = await geminiGuarded('k', ['a', 'b'], { system: 's', contents: [] }, memoryStore(), cfg(f));
    expect(r.text).toBe('x');
    expect(calls.map(model)).toEqual(['a', 'a', 'a']);
  });

  it('falls back to the next model when one stays overloaded, without blocking it', async () => {
    const { f, calls } = mockFetch((c) => (model(c) === 'a' ? busy : ok('y')));
    const store = memoryStore();
    const r = await geminiGuarded('k', ['a', 'b'], { system: 's', contents: [] }, store, cfg(f));
    expect(r.text).toBe('y');
    expect(calls.map(model)).toEqual(['a', 'a', 'a', 'b']);
    expect(store.blocks).toEqual({});
  });

  it('all overloaded → clear German message instead of "nicht erreichbar"', async () => {
    const { f } = mockFetch(() => busy);
    await expect(geminiGuarded('k', ['a', 'b'], { system: 's', contents: [] }, memoryStore(), cfg(f))).rejects.toMatchObject({ code: 'overloaded', message: expect.stringContaining('überlastet') });
  });

  it('overloaded beats the quota note of the fallback model', async () => {
    const { f } = mockFetch((c) => (model(c) === 'a' ? busy : quota(false)));
    await expect(geminiGuarded('k', ['a', 'b'], { system: 's', contents: [] }, memoryStore(), cfg(f))).rejects.toMatchObject({ code: 'overloaded' });
  });

  it('unknown model alias (404) and timeouts move on to the next model', async () => {
    const { f, calls } = mockFetch((c) => (model(c) === 'a' ? { status: 404, json: { error: { message: 'not found' } } } : ok('z')));
    expect((await geminiGuarded('k', ['a', 'b'], { system: 's', contents: [] }, memoryStore(), cfg(f))).text).toBe('z');
    expect(calls.map(model)).toEqual(['a', 'b']);

    let first = true;
    const slow = (async (url: string) => {
      if (first) {
        first = false;
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      }
      return new Response(JSON.stringify(ok('t').json), { status: 200 });
    }) as unknown as typeof fetch;
    expect((await geminiGuarded('k', ['a', 'b'], { system: 's', contents: [] }, memoryStore(), cfg(slow))).text).toBe('t');
  });

  it('quotaFallback=false: a used-up quota blocks right away, the second model is not asked', async () => {
    const { f, calls } = mockFetch(() => quota(true));
    const store = memoryStore();
    await expect(geminiGuarded('k', ['a', 'b'], { system: 's', contents: [] }, store, cfg(f), { quotaFallback: false })).rejects.toMatchObject({ code: 'rate_limited', daily: true });
    expect(calls.map(model)).toEqual(['a']);
    // afterwards the paused model is not bypassed via the second one
    await expect(geminiGuarded('k', ['a', 'b'], { system: 's', contents: [] }, store, cfg(f), { quotaFallback: false })).rejects.toMatchObject({ code: 'rate_limited' });
    expect(calls).toHaveLength(1);
  });

  it('tasks: photos try Flash, Flash-Lite and the pinned fallback models in turn', async () => {
    const { f, calls } = mockFetch((c) => (model(c).startsWith('gemini-3.8') ? { status: 200, json: { candidates: [{ content: { parts: [{ text: '{"items":[],"note":"ok"}' }] }, finishReason: 'STOP' }] } } : c.url.includes('3.5') ? { status: 404, json: {} } : busy));
    const r = await aiMealPhoto({ key: 'k', store: memoryStore(), cfg: { fetchImpl: f, retryDelaysMs: [0, 0] } }, { data: 'x', mediaType: 'image/jpeg' });
    expect(r?.note).toBe('ok');
    expect([...new Set(calls.map(model))]).toEqual(['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.8-flash']);
  });

  it('offline (network error) is reported as such and not retried', async () => {
    let n = 0;
    const off = (async () => {
      n++;
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(geminiGuarded('k', ['a', 'b'], { system: 's', contents: [] }, memoryStore(), cfg(off))).rejects.toMatchObject({ code: 'unavailable', message: expect.stringContaining('online') });
    expect(n).toBe(1);
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

import { geminiCheckKey, looksLikeGeminiKey, normalizeGeminiKey } from '../src/ai/gemini';

describe('gemini keys', () => {
  it('accepts the new "AQ." auth keys and the older "AIza" keys, cleans pasted text', () => {
    expect(looksLikeGeminiKey('AQ.Ab8RN6LxZ3_example-Key.part2')).toBe(true);
    expect(looksLikeGeminiKey('AIzaSyA1234567890abcdefghijklmnopqrstu')).toBe(true);
    expect(looksLikeGeminiKey('kurz')).toBe(false);
    expect(normalizeGeminiKey(' „AQ.Ab8RN6​LxZ3_example-Key"\n')).toBe('AQ.Ab8RN6LxZ3_example-Key');
  });
  it('key check lists one model (no tokens) and returns Google\'s reason', async () => {
    const { f, calls } = mockFetch(() => ({ status: 400, json: { error: { message: 'API key not valid. Please pass a valid API key.' } } }));
    const r = await geminiCheckKey('AQ.x', { fetchImpl: f });
    expect(calls[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1');
    expect(calls[0].key).toBe('AQ.x');
    expect(r).toEqual({ result: 'invalid', message: 'API key not valid. Please pass a valid API key.' });
  });
});
