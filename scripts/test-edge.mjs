// Integration test of the AI edge functions (coach, meal-photo, body-fat) against the
// LOCAL Supabase stack and a mock Gemini API – no real key, no costs.
// Usage: npm run db:start && npm run test:edge
import { execSync, spawn } from 'node:child_process';
import http from 'node:http';
import assert from 'node:assert/strict';
import { generateDemoData, todayISO } from '../supabase/functions/_shared/core.mjs';

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
if (!/127\.0\.0\.1|localhost/.test(status.API_URL)) throw new Error('Refusing to run against a non-local Supabase instance.');
const API = status.API_URL;
const ANON = status.ANON_KEY;

// ---------------------------------------------------------------- mock Gemini
const calls = [];
let mode = 'ok';
const REPORT = Array.from({ length: 7 }, (_, i) => ({ heading: `${i + 1}. Abschnitt`, body: 'Text' }));
const mock = http.createServer(async (req, res) => {
  let raw = '';
  for await (const c of req) raw += c;
  const body = JSON.parse(raw || '{}');
  calls.push({ url: req.url, key: req.headers['x-goog-api-key'], body });
  const send = (code, obj) => {
    res.writeHead(code, { 'content-type': 'application/json' });
    res.end(JSON.stringify(obj));
  };
  if (mode === '429') return send(429, { error: { code: 429, message: 'Resource has been exhausted', status: 'RESOURCE_EXHAUSTED' } });
  if (mode === 'blocked') return send(200, { promptFeedback: { blockReason: 'SAFETY' }, modelVersion: 'gemini-mock' });
  const props = body.generationConfig?.responseJsonSchema?.properties ?? {};
  let text = 'Heute steht Oberkörper A an – starte mit Bankdrücken.';
  if (props.sections) text = JSON.stringify({ sections: REPORT });
  if (props.items) text = JSON.stringify({ items: [{ name: 'Hähnchenbrust', grams: 150, kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, confidence: 'medium' }], note: 'Soße geschätzt.' });
  if (props.body_fat_pct) text = JSON.stringify({ usable: true, body_fat_pct: 18.4, range_low: 17.5, range_high: 19, confidence: 'medium', cues: 'Leichte Bauchdefinition.', photo_tips: 'Gleiches Licht.' });
  send(200, { candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }], modelVersion: 'gemini-mock-001' });
});
await new Promise((r) => mock.listen(8788, '127.0.0.1', r));

// ---------------------------------------------------------------- test user with data
const email = `edge-${Date.now().toString(36)}@example.com`;
const password = 'Sicher12345!';
const signup = await (await fetch(`${API}/auth/v1/signup`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json();
const jwt = signup.access_token;
assert.ok(jwt, 'signup failed');
const data = generateDemoData({ userId: signup.user.id, today: todayISO(), weeks: 3, seed: Date.now() % 1_000_000 });
for (const table of ['athlete_profiles', 'workout_plans', 'plan_days', 'plan_exercises', 'workout_sessions', 'workout_sets', 'meal_entries', 'weight_entries', 'step_entries']) {
  const r = await fetch(`${API}/rest/v1/${table}?on_conflict=id`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(data[table]),
  });
  assert.ok(r.ok, `${table}: ${r.status} ${await r.text()}`);
}

// ---------------------------------------------------------------- function runner
async function withFunction(name, env, fn) {
  const proc = spawn('npx', ['-y', 'deno@latest', 'run', '-A', `supabase/functions/${name}/index.ts`], {
    env: { ...process.env, SUPABASE_URL: API, SUPABASE_ANON_KEY: ANON, GEMINI_API_BASE: 'http://127.0.0.1:8788', ...env, ...(process.env.DENO_CERT ? {} : { DENO_CERT: '/root/.ccr/ca-bundle.crt' }) },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true, // own process group: npx → deno are killed together
  });
  let log = '';
  proc.stdout.on('data', (d) => (log += d));
  proc.stderr.on('data', (d) => (log += d));
  try {
    for (let i = 0; ; i++) {
      if (i > 240) throw new Error(`${name} did not start:\n${log}`);
      if (await fetch('http://127.0.0.1:8000', { method: 'OPTIONS' }).then(() => true, () => false)) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    await fn();
  } finally {
    process.kill(-proc.pid, 'SIGTERM');
    await new Promise((r) => proc.once('exit', r));
    while (await fetch('http://127.0.0.1:8000', { method: 'OPTIONS' }).then(() => true, () => false)) await new Promise((r) => setTimeout(r, 200));
  }
}
const call = async (body, token = jwt) => {
  const r = await fetch('http://127.0.0.1:8000', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
};
const img = { data: Buffer.from('fake-jpeg').toString('base64'), mediaType: 'image/jpeg' };
let passed = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  passed++;
  console.log(`ok   ${msg}`);
};

const KEY = { GEMINI_API_KEY: 'test-key', AI_DAILY_LIMIT: '6' };

await withFunction('coach', KEY, async () => {
  ok((await call({ action: 'chat', message: 'Hallo' }, 'invalid')).status === 401, 'coach: 401 without valid session');
  let r = await call({ action: 'chat', message: 'Was trainiere ich heute?', history: [{ role: 'assistant', content: 'Hi' }, { role: 'user', content: 'Hey' }, { role: 'assistant', content: 'Wie kann ich helfen?' }] });
  ok(r.body.source === 'ai' && r.body.reply.includes('Oberkörper A'), 'coach chat: answered by Gemini');
  const req = calls.at(-1);
  ok(req.url === '/v1beta/models/gemini-flash-latest:generateContent' && req.key === 'test-key', 'request: model path + x-goog-api-key header');
  ok(req.body.systemInstruction?.parts?.[0]?.text.length > 50, 'request: system instruction sent');
  ok(req.body.contents[0].role === 'user' && req.body.contents.at(-2).role === 'model', 'request: history mapped to user/model and starts with user');
  ok(req.body.contents.at(-1).parts[0].text.includes('<nutzerdaten>'), 'request: user data snapshot included');

  r = await call({ action: 'weekly_report' });
  ok(r.body.source === 'ai' && r.body.sections.length === 7, 'weekly report: 7 sections from Gemini');
  ok(!JSON.stringify(calls.at(-1).body.generationConfig.responseJsonSchema).includes('additionalProperties'), 'request: schema cleaned for Gemini');

  mode = 'blocked';
  r = await call({ action: 'chat', message: 'Wie viel Protein fehlt mir?' });
  ok(r.body.source === 'rules' && r.body.reply.length > 0, 'blocked response → rule-based answer');
  mode = '429';
  r = await call({ action: 'chat', message: 'Wie viel Protein fehlt mir?' });
  ok(r.body.source === 'rules' && /Kontingent/.test(r.body.warning), 'rate limit → rule-based answer with warning');
  mode = 'ok';
  r = await call({ action: 'chat', message: 'Noch eine Frage' }); // 5th AI call
  r = await call({ action: 'chat', message: 'Und noch eine' }); // 6th AI call
  const before = calls.length;
  r = await call({ action: 'chat', message: 'Über dem Limit' });
  ok(r.body.source === 'rules' && calls.length === before, 'daily limit reached → no Gemini call, rules answer');
});

await withFunction('coach', {}, async () => {
  const before = calls.length;
  const r = await call({ action: 'chat', message: 'Was trainiere ich heute?' });
  ok(r.body.source === 'rules' && calls.length === before, 'no GEMINI_API_KEY → free rule-based coach');
});

await withFunction('meal-photo', { GEMINI_API_KEY: 'test-key', AI_DAILY_LIMIT: '100' }, async () => {
  const r = await call({ image: img.data, mediaType: 'image/jpeg', hint: 'Mittagessen' });
  ok(r.status === 200 && r.body.items[0].name === 'Hähnchenbrust', 'meal photo: items parsed');
  ok(calls.at(-1).body.contents[0].parts[0].inlineData?.mimeType === 'image/jpeg', 'meal photo: image sent as inlineData');
  ok((await call({ image: img.data, mediaType: 'image/tiff' })).status === 415, 'meal photo: unsupported format rejected');
});

await withFunction('meal-photo', {}, async () => {
  const r = await call({ image: img.data, mediaType: 'image/jpeg' });
  ok(r.status === 501 && r.body.code === 'not_configured', 'meal photo without key → 501 not_configured');
});

await withFunction('body-fat', { GEMINI_API_KEY: 'test-key', AI_DAILY_LIMIT: '100' }, async () => {
  let r = await call({ images: [{ ...img, pose: 'front' }, { ...img, pose: 'side' }] });
  ok(r.status === 200 && r.body.body_fat_pct === 18.4, 'body fat: estimate returned');
  ok(r.body.range_high - r.body.range_low >= 4, 'body fat: range widened to ≥ 4 points');
  const parts = calls.at(-1).body.contents[0].parts;
  ok(parts.filter((p) => p.inlineData).length === 2, 'body fat: both photos sent');
  ok(/Größe: \d+ cm/.test(parts.at(-1).text), 'body fat: profile context from DB included');
  ok((await call({ images: [] })).status === 400, 'body fat: no photo → 400');
  mode = 'blocked';
  r = await call({ images: [{ ...img, pose: 'front' }] });
  ok(r.status === 422, 'body fat: blocked → 422 with fallback hint');
  mode = 'ok';
});

mock.close();
console.log(`\n${passed} edge-function checks passed`);
process.exit(0);
