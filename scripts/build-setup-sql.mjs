// Combines all migrations into supabase/setup.sql – paste it once into the
// Supabase SQL Editor of a new (free) project. No CLI, tokens or passwords needed.
// Usage: npm run build:setup-sql
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = 'supabase/migrations';
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const parts = files.map((f) => `-- ============================================================\n-- ${f}\n-- ============================================================\n${readFileSync(`${dir}/${f}`, 'utf8').trim()}\n`);
const header = `-- Gymolingo – komplette Datenbank-Einrichtung (generiert aus supabase/migrations, nicht von Hand ändern)
-- Supabase → SQL Editor → New query → alles einfügen → Run. Nur EINMAL pro Projekt ausführen.
`;
writeFileSync('supabase/setup.sql', `${header}\n${parts.join('\n')}`);
console.log(`supabase/setup.sql: ${files.length} migrations`);
