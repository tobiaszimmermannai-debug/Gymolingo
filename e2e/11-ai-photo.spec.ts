import { expect, test } from '@playwright/test';
import { completeOnboarding, mockGemini } from './helpers';

test('meal photo survives Google overload: retry + fallback model, clear message, no quota used', async ({ page }) => {
  const google = await mockGemini(page);
  await completeOnboarding(page);
  await page.goto('/settings/ai');
  await page.getByTestId('ai-key-input').fill('AQ.Ab8RN6PhotoTestKey-0000000.ph01');
  await page.getByTestId('ai-key-save').click();
  await expect(page.getByTestId('ai-key-status')).toContainText('…ph01');

  const photo = await page.screenshot({ type: 'jpeg', quality: 70 });
  await page.goto('/nutrition/photo?meal=lunch');
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('meal-photo-gallery').click();
  await (await chooser).setFiles({ name: 'meal.jpg', mimeType: 'image/jpeg', buffer: photo });

  // Flash answers 503 "high demand" → retried, then Flash-Lite analyses the photo
  google.mode = 'flash503';
  await page.getByTestId('meal-photo-analyze').click();
  await expect(page.getByTestId('meal-photo-item')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByTestId('meal-photo-item')).toContainText('520 kcal');
  const models = google.calls.map((c) => c.url.split('/models/')[1].split(':')[0]);
  expect(models).toEqual(['gemini-flash-latest', 'gemini-flash-latest', 'gemini-flash-latest', 'gemini-flash-lite-latest']);

  // everything overloaded → understandable message, the failed attempt is not counted
  google.mode = 'all503';
  await page.getByTestId('meal-photo-analyze').click();
  await expect(page.getByTestId('meal-photo-error')).toContainText('überlastet', { timeout: 30_000 });
  await page.goto('/settings/ai');
  await expect(page.getByTestId('ai-usage')).toContainText('Heute 1 von 25');
});
