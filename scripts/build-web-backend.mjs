// Builds the web app against the local Supabase stack (for backend E2E tests).
import { execSync } from 'node:child_process';

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
execSync('npx expo export --platform web --output-dir dist-backend --clear', {
  cwd: 'apps/mobile',
  stdio: 'inherit',
  // AI UI enabled: the E2E tests mock the edge functions (no Gemini key, no costs)
  env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: status.API_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY, EXPO_PUBLIC_AI_ENABLED: 'true' },
});
