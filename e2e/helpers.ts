import { expect, type Page } from '@playwright/test';

export async function completeOnboarding(page: Page, opts: { name?: string; goal?: string } = {}) {
  await page.goto('/');
  await page.getByTestId('onboarding-start').click();
  await page.getByTestId('input-name').fill(opts.name ?? 'Alex');
  await page.getByTestId('input-age').fill('30');
  await page.getByTestId('input-height').fill('180');
  await page.getByTestId('input-weight').fill('85');
  await page.getByTestId('onboarding-next').click(); // → experience
  await page.getByTestId('exp-intermediate').click();
  await page.getByTestId('onboarding-next').click(); // → goal
  await page.getByTestId(`goal-${opts.goal ?? 'fat_loss'}`).click();
  await page.getByTestId('onboarding-next').click(); // → training
  await page.getByTestId('days-4').click();
  await page.getByTestId('onboarding-next').click(); // → activity
  await page.getByTestId('activity-moderate').click();
  await page.getByTestId('onboarding-next').click(); // → diet
  await page.getByTestId('onboarding-next').click(); // → targets
  await expect(page.getByTestId('target-kcal')).toContainText('kcal');
  await page.getByTestId('onboarding-next').click(); // → plan
  await page.getByTestId('onboarding-next').click(); // → reminders
  await page.getByTestId('reminders-toggle').click(); // disable notifications in tests
  await page.getByTestId('onboarding-finish').click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
}

/** width/height from a JPEG's SOF marker */
export function jpegSize(buf: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < buf.length) {
    const marker = buf.readUInt16BE(i);
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xffc0 && marker <= 0xffc3) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error('no SOF marker');
}

type Mode = 'ok' | 'daily429';
/** Simulates the Gemini REST API (key validation + generateContent) for a page. */
export async function mockGemini(page: Page) {
  const state = { mode: 'ok' as Mode, calls: [] as { url: string; key: string | undefined; body: any }[] };
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const key = req.headers()['x-goog-api-key'];
    if (req.method() === 'GET') {
      if (key?.startsWith('AIzaBAD')) return route.fulfill({ status: 400, headers: cors, json: { error: { code: 400, message: 'API key not valid.' } } });
      return route.fulfill({ status: 200, headers: cors, json: { name: 'models/gemini-flash-lite-latest' } });
    }
    const body = req.postDataJSON();
    state.calls.push({ url: req.url(), key, body });
    if (state.mode === 'daily429')
      return route.fulfill({ status: 429, headers: cors, json: { error: { code: 429, status: 'RESOURCE_EXHAUSTED', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } } });
    const props = body.generationConfig?.responseJsonSchema?.properties ?? {};
    let text = 'KI-Antwort: Heute steht Oberkörper A an.';
    if (props.body_fat_pct) text = JSON.stringify({ usable: true, body_fat_pct: 17.2, range_low: 15, range_high: 19.5, confidence: 'medium', cues: 'Leichte Bauchdefinition sichtbar.', photo_tips: 'Gleiches Licht und Abstand.' });
    if (props.sections) text = JSON.stringify({ sections: Array.from({ length: 7 }, (_, i) => ({ heading: `${i + 1}. KI-Abschnitt`, body: 'Text' })) });
    await route.fulfill({ status: 200, headers: cors, json: { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }], modelVersion: 'mock' } });
  });
  return state;
}

