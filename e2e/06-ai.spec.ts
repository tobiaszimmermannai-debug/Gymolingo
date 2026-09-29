import { expect, test, type Page } from '@playwright/test';
import { completeOnboarding, jpegSize } from './helpers';

/**
 * AI with a Gemini key stored on the device – Google is simulated with page.route,
 * so no real key and no requests to Google are needed.
 */
type Mode = 'ok' | 'daily429';
async function mockGemini(page: Page) {
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

test('Gemini key on the device: coach, body fat from photos, daily limit display and hard block on quota', async ({ page }) => {
  const google = await mockGemini(page);
  await completeOnboarding(page);

  // key setup with validation
  await page.goto('/settings/ai');
  await page.getByTestId('ai-key-input').fill('AIzaBAD_invalid_key_00000000000000');
  await page.getByTestId('ai-key-save').click();
  await expect(page.getByTestId('ai-key-msg')).toContainText('lehnt');
  await page.getByTestId('ai-key-input').fill('AIzaSyTestSharedKey000000000000wxyz');
  await page.getByTestId('ai-key-save').click();
  await expect(page.getByTestId('ai-key-status')).toContainText('…wxyz');
  await expect(page.getByTestId('ai-usage')).toContainText('Heute 0 von 25');

  // coach answers via Gemini (Flash-Lite), with the real data snapshot
  await page.goto('/coach');
  await page.getByTestId('coach-input').fill('Was steht heute an?');
  await page.getByTestId('coach-send').click();
  await expect(page.getByTestId('coach-msg-assistant').last()).toContainText('KI-Antwort');
  const chat = google.calls.at(-1)!;
  expect(chat.url).toContain('/models/gemini-flash-lite-latest:generateContent');
  expect(chat.key).toBe('AIzaSyTestSharedKey000000000000wxyz');
  expect(JSON.stringify(chat.body.contents)).toContain('<nutzerdaten>');

  // body fat: adding a photo starts the estimate (consent first), downscaled to 1024 px, Flash model
  const big = await page.screenshot({ type: 'jpeg', quality: 80, scale: 'device' });
  expect(jpegSize(big).height).toBeGreaterThan(1500);
  await page.goto('/body/photos');
  page.once('dialog', (d) => d.accept());
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('photo-gallery').click();
  await (await chooser).setFiles({ name: 'front.jpg', mimeType: 'image/jpeg', buffer: big });
  await expect(page.getByTestId('bf-ai-result')).toContainText('17,2 %');
  await expect(page.getByTestId('bf-ai-result')).toContainText('15–20 % · Sicherheit mittel');
  const bf = google.calls.at(-1)!;
  expect(bf.url).toContain('/models/gemini-flash-latest:generateContent');
  const img = bf.body.contents[0].parts.find((p: any) => p.inlineData).inlineData;
  const size = jpegSize(Buffer.from(img.data, 'base64'));
  expect(Math.max(size.width, size.height)).toBe(1024);
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('bf-apply-ai').click();
  await page.goto('/body/weight');
  await expect(page.getByText('~17,2 %')).toBeVisible();

  // usage is counted per day and person
  await page.goto('/settings/ai');
  await expect(page.getByTestId('ai-usage')).toContainText('Heute 2 von 25');

  // Google reports the free quota as used up → AI blocked immediately, coach falls back to rules
  google.mode = 'daily429';
  await page.goto('/coach');
  await page.getByTestId('coach-input').fill('Wie viel Protein fehlt mir?');
  await page.getByTestId('coach-send').click();
  await expect(page.getByTestId('coach-msg-assistant').last()).toContainText('g Protein');
  const before = google.calls.length;
  google.mode = 'ok';
  await page.getByTestId('coach-input').fill('Und jetzt?');
  await page.getByTestId('coach-send').click();
  await expect(page.getByTestId('coach-msg-assistant')).toHaveCount(3);
  expect(google.calls.length).toBe(before); // blocked: Google is not called again
  await page.goto('/settings/ai');
  await expect(page.getByTestId('ai-blocked')).toContainText('gesperrt bis');

  // key can be removed again
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('ai-key-delete').click();
  await expect(page.getByTestId('ai-key-status')).toContainText('Noch kein Schlüssel');
});
