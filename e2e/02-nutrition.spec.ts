import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers';

test('search a German food, log it with a serving and see totals', async ({ page }) => {
  await completeOnboarding(page);
  await page.getByTestId('tab-nutrition').click();
  await expect(page.getByTestId('nutrition-screen')).toBeVisible();
  const before = Number((await page.getByTestId('nutrition-kcal-remaining').innerText()).replace('.', ''));

  await page.getByTestId('add-breakfast').click();
  await page.getByTestId('food-search').fill('magerquark');
  await page.getByTestId('food-result-0').click();
  await expect(page.getByTestId('food-amount-screen')).toBeVisible();
  // default serving: 1 Becher (250 g) → 168 kcal, 30 g protein
  await expect(page.getByTestId('amount-kcal')).toHaveText('168');
  await expect(page.getByTestId('amount-protein')).toHaveText('30 g');
  await page.getByTestId('log-food').click();

  await expect(page.getByTestId('nutrition-screen')).toBeVisible();
  await expect(page.getByTestId('meal-breakfast')).toContainText('Magerquark');
  const after = Number((await page.getByTestId('nutrition-kcal-remaining').innerText()).replace('.', ''));
  expect(before - after).toBe(168);
  await expect(page.getByTestId('macro-protein')).toContainText('30 / ');
});

test('custom food, quick entry (estimate), correction and repeat meal', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/nutrition/add?meal=snack');
  await page.getByTestId('action-custom').click();
  await page.getByTestId('cf-name').fill('Mein Proteinriegel');
  await page.getByTestId('cf-kcal').fill('380');
  await page.getByTestId('cf-protein').fill('33');
  await page.getByTestId('cf-carbs').fill('30');
  await page.getByTestId('cf-fat').fill('12');
  await page.getByTestId('save-custom-food').click();
  await page.getByTestId('amount-grams').fill('45');
  await expect(page.getByTestId('amount-kcal')).toHaveText('171');
  await page.getByTestId('log-food').click();
  await expect(page.getByTestId('meal-snack')).toContainText('Mein Proteinriegel');

  // implausible values are rejected
  await page.goto('/nutrition/custom-food?meal=snack');
  await page.getByTestId('cf-name').fill('Kaputt');
  await page.getByTestId('cf-kcal').fill('50');
  await page.getByTestId('cf-protein').fill('60');
  await page.getByTestId('cf-carbs').fill('30');
  await page.getByTestId('cf-fat').fill('20');
  await page.getByTestId('save-custom-food').click();
  await expect(page.getByText('Makros ergeben mehr als 100 g')).toBeVisible();

  // quick entry is flagged as estimate and can be corrected
  await page.goto('/nutrition/quick?meal=lunch');
  await page.getByTestId('quick-kcal').fill('750');
  await page.getByTestId('quick-protein').fill('35');
  await page.getByTestId('quick-save').click();
  const lunch = page.getByTestId('meal-lunch');
  await expect(lunch).toContainText('Schnelleintrag');
  await expect(lunch).toContainText('Schätzung');
  await lunch.getByText('Schnelleintrag', { exact: true }).click();
  await page.getByTestId('manual-kcal').fill('820');
  await page.getByTestId('save-entry').click();
  await expect(page.getByTestId('meal-lunch')).toContainText('820 kcal');
  await expect(page.getByTestId('meal-lunch')).not.toContainText('Schätzung');

  // "Mahlzeit wiederholen": go to tomorrow and copy today's snack
  page.on('dialog', (d) => d.accept());
  await page.getByLabel('Nächster Tag').click();
  await expect(page.getByTestId('meal-snack')).not.toContainText('Mein Proteinriegel');
  await page.getByTestId('repeat-snack').click();
  await expect(page.getByTestId('meal-snack')).toContainText('Mein Proteinriegel');
  await expect(page.getByTestId('meal-snack')).toContainText('171 kcal');
});
