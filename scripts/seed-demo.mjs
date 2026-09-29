// Seeds the LOCAL development Supabase stack with a realistic demo account
// (12 weeks of training, nutrition, weight, steps, check-ins).
// Usage: npm run db:start && node scripts/seed-demo.mjs [email] [password]
import { execSync } from 'node:child_process';
import { generateDemoData, todayISO } from '../supabase/functions/_shared/core.mjs';

const [email = 'demo@gymolingo.dev', password = 'Demo12345!'] = process.argv.slice(2);
const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
if (!/127\.0\.0\.1|localhost/.test(status.API_URL)) throw new Error('Refusing to seed a non-local Supabase instance.');
const URL = status.API_URL;
const ANON = status.ANON_KEY;

async function auth(path, body) {
  const r = await fetch(`${URL}/auth/v1/${path}`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}
let session = await auth('token?grant_type=password', { email, password });
if (!session.access_token) session = await auth('signup', { email, password, data: { display_name: 'Demo' } });
if (!session.access_token) throw new Error(`Login failed: ${JSON.stringify(session)}`);
const userId = session.user.id;

const data = generateDemoData({ userId, today: todayISO(), weeks: 12, seed: 42 });
const order = ['athlete_profiles', 'workout_plans', 'plan_days', 'plan_exercises', 'workout_sessions', 'workout_sets', 'meal_entries', 'weight_entries', 'step_entries', 'daily_checkins', 'body_measurements', 'cardio_sessions'];
for (const table of order) {
  const rows = data[table];
  for (let i = 0; i < rows.length; i += 500) {
    const r = await fetch(`${URL}/rest/v1/${table}?on_conflict=id`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
  }
  console.log(`${table}: ${rows.length}`);
}
await fetch(`${URL}/rest/v1/profiles?id=eq.${userId}`, { method: 'PATCH', headers: { apikey: ANON, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'demo', display_name: 'Demo' }) });
console.log(`Seeded demo account ${email} / ${password}`);
