import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers';

test('weight logging updates 7-day average and home card', async ({ page }) => {
  await completeOnboarding(page);
  await page.getByTestId('home-weight-card').click();
  await expect(page.getByTestId('weight-screen')).toBeVisible();
  // onboarding already stored 85 kg for today → update it
  await page.getByTestId('weight-input').fill('84,4');
  await page.getByTestId('save-weight').click();
  await expect(page.getByTestId('avg7')).toHaveText('84,4 kg');
  await expect(page.getByTestId('weight-chart')).toBeVisible();
  await page.getByTestId('weight-input').fill('500');
  await page.getByTestId('save-weight').click();
  await expect(page.getByText('zwischen 20 und 400 kg')).toBeVisible();
});

test('evening check-in stores steps, closes the day and updates streaks', async ({ page }) => {
  await completeOnboarding(page);
  await page.getByTestId('task-checkin').click();
  await expect(page.getByTestId('checkin-screen')).toBeVisible();
  await page.getByTestId('submit-checkin').click();
  await expect(page.getByText('Trage deine Schritte ein')).toBeVisible();
  await page.getByTestId('steps-input').fill('11234');
  await page.getByLabel('Stimmung 4 von 5').click();
  await page.getByLabel('Energie 3 von 5').click();
  await page.getByTestId('submit-checkin').click();
  await expect(page.getByTestId('checkin-done')).toBeVisible();
  await expect(page.getByTestId('checkin-done')).toContainText('Täglicher Check-in');
  await page.getByText('Zur Startseite').click();
  await expect(page.getByTestId('home-steps-card')).toContainText('11.234');
  await expect(page.getByTestId('task-checkin')).toContainText('Tag abgeschlossen');
});

test('progress dashboard and achievements render real data', async ({ page }) => {
  await completeOnboarding(page);
  await page.getByTestId('tab-progress').click();
  await expect(page.getByTestId('progress-screen')).toBeVisible();
  await expect(page.getByTestId('kpi-workouts')).toContainText('0');
  for (const p of ['7d', '90d', '6m', '1y', 'all']) await page.getByTestId(`period-${p}`).click();
  await expect(page.getByTestId('progress-weight-chart')).toBeVisible();

  await page.goto('/achievements');
  await expect(page.getByTestId('achievements-screen')).toBeVisible();
  await expect(page.getByTestId('streak-training')).toBeVisible();
  await page.getByTestId('add-pause').click();
  await expect(page.getByText('Urlaub ·')).toBeVisible();
  await page.getByTestId('ach-tab-badges').click();
  await expect(page.getByTestId('badge-first-workout')).toBeVisible();
});

test('settings: targets recalculation, reminders preview, privacy toggles, export', async ({ page }) => {
  await completeOnboarding(page);
  await page.getByTestId('open-settings').click();
  await page.getByTestId('settings-profile').click();
  await page.getByTestId('recalc-targets').click();
  await expect(page.getByText('Neu berechnet mit')).toBeVisible();
  await page.goto('/settings/reminders');
  // reminders were switched off during onboarding in tests
  await expect(page.getByTestId('reminder-preview')).toContainText('Keine Erinnerungen');
  await page.getByTestId('reminders-enabled').click();
  await expect(page.getByTestId('reminder-preview')).toContainText('Tagesabschluss');
  await page.getByTestId('intensity-gentle').click();
  await page.goto('/settings/privacy');
  const weightToggle = page.getByTestId('privacy-weight').locator('input');
  await expect(weightToggle).not.toBeChecked();
  await expect(page.getByTestId('privacy-workouts').locator('input')).toBeChecked();
  await weightToggle.click();
  await expect(weightToggle).toBeChecked();
  await page.goto('/settings/account');
  const download = page.waitForEvent('download');
  await page.getByTestId('export-data').click();
  const d = await download;
  expect(d.suggestedFilename()).toMatch(/gymolingo-export-\d{4}-\d{2}-\d{2}\.json/);
  const content = JSON.parse(await (await d.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8')));
  expect(content.format).toBe('gymolingo-export-v1');
  expect(content.tables.athlete_profiles[0].display_name).toBe('Alex');
});

test('delete all local data (guest)', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/settings/account');
  await page.getByTestId('delete-confirm').fill('LÖSCHEN');
  await page.getByTestId('delete-account').click();
  await expect(page.getByTestId('onboarding-start')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('onboarding-start')).toBeVisible();
});

test('body fat from tape measurements (Navy formula) is marked as estimate', async ({ page }) => {
  await completeOnboarding(page); // male, 180 cm, 85 kg logged today
  await page.goto('/body/measurements');
  await expect(page.getByTestId('bodyfat-card')).toContainText('Miss Taille, Hals');
  await page.getByTestId('m-neck_cm').fill('38');
  await page.getByTestId('m-waist_cm').fill('85');
  await page.getByTestId('save-measurements').click();
  await expect(page.getByTestId('bf-navy-value')).toContainText('16,1 %');
  // no AI section in the zero-cost build
  await page.goto('/body/photos');
  await expect(page.getByTestId('bf-navy-value')).toContainText('16,1 %');
  await expect(page.getByTestId('bf-ai')).toHaveCount(0);
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('bf-apply-navy').click();
  await page.goto('/body/weight');
  await expect(page.getByText('~16,1 %')).toBeVisible();
});
