import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers';

test('running and EMS: calories, pace, training list, briefing, progress and optional calorie target', async ({ page }) => {
  await completeOnboarding(page); // 85 kg
  await page.getByTestId('tab-training').click();

  // jog: 5 km in 30 min → 6:00 min/km, 10 km/h, MET 10 × 85 kg × 0.5 h = 425 kcal
  await page.getByTestId('add-cardio-jog').click();
  await page.getByTestId('cardio-duration').fill('30');
  await page.getByTestId('cardio-distance').fill('5');
  await expect(page.getByTestId('cardio-pace')).toHaveText('6:00 min/km · 10 km/h');
  await expect(page.getByTestId('cardio-kcal')).toHaveText('≈ 425 kcal');
  await page.getByTestId('cardio-save').click();

  // EMS intense 20 min: MET 5.5 × 85 kg × 1/3 h = 156 kcal; no distance field
  await page.getByTestId('add-cardio-ems').click();
  await expect(page.getByTestId('cardio-distance')).toHaveCount(0);
  await expect(page.getByTestId('cardio-duration')).toHaveValue('20');
  await page.getByTestId('cardio-intensity-intense').click();
  await expect(page.getByTestId('cardio-kcal')).toHaveText('≈ 156 kcal');
  await page.getByTestId('cardio-intensity-light').click();
  await expect(page.getByTestId('cardio-kcal')).toHaveText('≈ 99 kcal');
  await page.getByTestId('cardio-intensity-intense').click();
  await page.getByTestId('cardio-save').click();

  await expect(page.getByTestId('cardio-entry')).toHaveCount(2);
  await expect(page.getByTestId('cardio-entry').first()).toContainText('156 kcal');

  // edit with a value from the watch
  await page.getByTestId('cardio-entry').nth(1).click();
  await page.getByTestId('cardio-kcal-override').fill('450');
  await page.getByTestId('cardio-save').click();
  await expect(page.getByTestId('cardio-entry').nth(1)).toContainText('450 kcal');

  // briefing + progress
  await page.getByTestId('tab-index').click();
  await expect(page.getByTestId('home-coach-card')).toContainText('ca. 606 kcal verbrannt');
  await page.getByTestId('tab-progress').click();
  await expect(page.getByTestId('kpi-cardio')).toContainText('2×');
  await expect(page.getByTestId('kpi-cardio')).toContainText('5 km · 606 kcal');

  // optional: add exercise calories to the daily target
  await page.goto('/nutrition');
  const before = Number((await page.getByTestId('nutrition-kcal-remaining').innerText()).replace('.', ''));
  await page.goto('/settings/profile');
  await page.getByTestId('toggle-exercise-calories').locator('input').click();
  await page.goto('/nutrition');
  await expect(page.getByTestId('nutrition-kcal-remaining')).toHaveText((before + 606).toLocaleString('de-DE'));

  // offline coach knows the sessions
  await page.goto('/coach');
  await page.getByTestId('coach-input').fill('Wie viel habe ich beim Laufen und EMS verbrannt?');
  await page.getByTestId('coach-send').click();
  await expect(page.getByTestId('coach-msg-assistant').last()).toContainText('606 kcal');
});
