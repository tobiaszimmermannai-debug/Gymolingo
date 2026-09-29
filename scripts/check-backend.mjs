// Checks a hosted Supabase project with the PUBLIC key only (no secrets):
// are the Gymolingo tables/functions there, and is e-mail confirmation off?
// Used by the Deploy PWA workflow; prints GitHub notices, never fails the build.
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const notice = (m) => console.log(`::notice::${m}`);
const warn = (m) => console.log(`::warning::${m}`);
if (!URL || !KEY) {
  notice('Kein Backend konfiguriert – lokaler Modus.');
  process.exit(0);
}
const h = { apikey: KEY };
/** exists when anon gets "permission denied" (42501) instead of "not found" */
async function exists(kind, name) {
  try {
    const r = kind === 'table' ? await fetch(`${URL}/rest/v1/${name}?limit=0`, { headers: h }) : await fetch(`${URL}/rest/v1/rpc/${name}`, { method: 'POST', headers: { ...h, 'content-type': 'application/json' }, body: '{}' });
    const body = await r.json().catch(() => ({}));
    if (r.ok || body.code === '42501') return true;
    if (['PGRST205', 'PGRST202', '42P01', '42883'].includes(body.code)) return false;
    return `unklar (${r.status} ${body.code ?? ''} ${body.message ?? ''})`;
  } catch (e) {
    return `nicht erreichbar (${e.message})`;
  }
}
const checks = [
  ['Grundschema', 'table', 'athlete_profiles', 'setup.sql'],
  ['Community', 'table', 'friendships', 'setup.sql'],
  ['Zuletzt online', 'rpc', 'friends_activity', 'setup.sql'],
  ['Lauf & EMS', 'table', 'cardio_sessions', 'Update-SQL (supabase/updates/2026-09-29.sql)'],
  ['Gemeinsamer KI-Schlüssel', 'rpc', 'get_shared_ai_key', 'Update-SQL (supabase/updates/2026-09-29.sql)'],
];
let missing = 0;
const results = [];
for (const [label, kind, name, fix] of checks) results.push([label, await exists(kind, name), fix]);
// empty database → only the complete setup.sql applies (the update needs the base schema)
const baseMissing = results[0][1] === false;
for (const [label, ok, fix] of results) {
  if (ok === true) notice(`✅ ${label}: vorhanden`);
  else if (ok === false) {
    missing++;
    warn(`❌ ${label}: fehlt – bitte ${baseMissing ? 'die komplette supabase/setup.sql' : fix} im Supabase SQL Editor ausführen`);
  } else warn(`⚠️ ${label}: ${ok}`);
}
try {
  const s = await (await fetch(`${URL}/auth/v1/settings`, { headers: h })).json();
  if (s.mailer_autoconfirm === true) notice('✅ E-Mail-Bestätigung ist aus');
  else if (s.mailer_autoconfirm === false) warn('⚠️ E-Mail-Bestätigung ist an – Registrierung braucht dann eine Bestätigungsmail (Authentication → Sign In / Providers → Email → „Confirm email“ aus)');
  if (s.disable_signup === true) warn('⚠️ Registrierung ist deaktiviert (Authentication → Sign In / Providers → „Allow new users to sign up“)');
} catch {
  warn('⚠️ Auth-Einstellungen nicht lesbar');
}
if (!missing) notice('Datenbank vollständig eingerichtet.');
