// Creates a confirmed test user in the local Supabase stack and prints a session token.
// Usage: node scripts/seed-user.mjs email password
const [email = 'coach-test@example.com', password = 'Test12345!'] = process.argv.slice(2);
const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY;
const res = await fetch(`${URL}/auth/v1/signup`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, data: { display_name: 'Test' } }) });
let body = await res.json();
if (!body.access_token) {
  const r2 = await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  body = await r2.json();
}
console.log(JSON.stringify({ token: body.access_token, user: body.user?.id }));
