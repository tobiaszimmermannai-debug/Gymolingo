import { expect, test } from '@playwright/test';
import { completeOnboarding, jpegSize, mockGemini } from './helpers';

/**
 * AI with a Gemini key stored on the device – Google is simulated with page.route,
 * so no real key and no requests to Google are needed.
 */
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
  await expect(page.getByTestId('ai-key-status')).toContainText('Noch keine KI aktiv');
});
