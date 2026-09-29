import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers';

test('activity catalog: search, sports and everyday activities with calories', async ({ page }) => {
  await completeOnboarding(page); // 85 kg
  await page.getByTestId('tab-training').click();
  await page.getByTestId('add-cardio-all').click();

  // list shows typical calories; search works without umlauts
  await page.getByTestId('activity-search').fill('fussball');
  await expect(page.getByTestId('pick-soccer')).toContainText('≈ 361 kcal'); // 8.5 MET × 85 kg × 0.5 h
  await page.getByTestId('pick-soccer').click();
  await expect(page.getByTestId('cardio-activity')).toContainText('Zählt als Trainingstag');
  await expect(page.getByTestId('cardio-duration')).toHaveValue('90');
  await expect(page.getByTestId('cardio-distance')).toHaveCount(0);
  await page.getByTestId('cardio-intensity-intense').click();
  await expect(page.getByTestId('cardio-intensity-intense')).toContainText('Spiel');
  await expect(page.getByTestId('cardio-kcal')).toHaveText('≈ 1.275 kcal'); // 10 MET × 85 × 1.5
  await page.getByTestId('cardio-save').click();

  // everyday: only the extra above rest counts
  await page.getByTestId('add-cardio-all').click();
  await page.getByTestId('activity-filter-household').click();
  await page.getByTestId('pick-vacuuming').click();
  await expect(page.getByTestId('cardio-estimate')).toContainText('Mehrverbrauch');
  await expect(page.getByTestId('cardio-kcal')).toHaveText('≈ 65 kcal'); // (3.3 − 1) × 85 × 20/60
  await page.getByTestId('cardio-save').click();

  await page.getByTestId('add-cardio-all').click();
  await page.getByTestId('activity-search').fill('Sex');
  await page.getByTestId('pick-sex').click();
  await page.getByTestId('cardio-intensity-intense').click();
  await expect(page.getByTestId('cardio-intensity-intense')).toContainText('Leidenschaftlich');
  await expect(page.getByTestId('cardio-kcal')).toHaveText('≈ 89 kcal');
  await page.getByTestId('cardio-save').click();

  // list + quick buttons remember the recent activities
  await expect(page.getByTestId('cardio-entry')).toHaveCount(3);
  await expect(page.getByTestId('cardio-entry').filter({ hasText: 'Fußball' })).toContainText('1.275 kcal');
  await expect(page.getByTestId('add-cardio-soccer')).toBeVisible();
  await page.getByTestId('tab-index').click();
  await expect(page.getByTestId('home-coach-card')).toContainText('ca. 1.429 kcal verbrannt');
});
