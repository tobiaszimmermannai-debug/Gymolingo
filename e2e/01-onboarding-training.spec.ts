import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers';

test('onboarding creates targets, plan and shows the home dashboard', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await completeOnboarding(page);
  await expect(page.getByText('Hallo, Alex', { exact: false }).or(page.getByText('Alex 👋', { exact: false })).first()).toBeVisible();
  // fat loss, 85 kg male → calorie target shown as remaining kcal (nothing eaten yet)
  const kcal = await page.getByTestId('kcal-remaining').innerText();
  expect(Number(kcal.replace('.', ''))).toBeGreaterThan(1800);
  await expect(page.getByTestId('home-training-card')).toBeVisible();
  // data persists across reload
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  expect(errors).toEqual([]);
});

test('log a full workout with progression and see PRs next time', async ({ page }) => {
  await completeOnboarding(page);
  await page.getByTestId('tab-training').click();
  await expect(page.getByTestId('training-screen')).toBeVisible();
  await page.getByTestId('start-day-Oberkörper A').click();
  await expect(page.getByTestId('active-workout')).toBeVisible();

  // first exercise: bench press – first time
  const bench = page.getByTestId('exercise-bench-press');
  await expect(bench).toBeVisible();
  const rows = bench.locator('[data-testid^="set-row-"]');
  const n = await rows.count();
  expect(n).toBe(3);
  const reps = [8, 8, 7];
  for (let i = 0; i < n; i++) {
    const row = rows.nth(i);
    const id = (await row.getAttribute('data-testid'))!.replace('set-row-', '');
    await page.getByTestId(`weight-${id}`).fill('80');
    await page.getByTestId(`reps-${id}`).fill(String(reps[i]));
    await page.getByTestId(`rir-${id}`).click(); // 0
    await page.getByTestId(`rir-${id}`).click(); // 1
    await page.getByTestId(`rir-${id}`).click(); // 2
    await page.getByTestId(`complete-${id}`).click();
  }
  await expect(page.getByTestId('rest-timer')).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('finish-workout').click();
  await expect(page.getByTestId('workout-detail')).toBeVisible();
  await expect(page.getByTestId('workout-complete-banner')).toBeVisible();

  // next time: double progression inside the plan's rep range (bench press 5–8): 8/8/7 → 8/8/8
  await page.waitForTimeout(500);
  await page.goto('/training');
  await page.getByTestId('start-day-Oberkörper A').click();
  await expect(page.getByTestId('suggestion-bench-press')).toContainText('80 kg × 8/8/8');
  // last weights are pre-filled
  const firstRow = page.getByTestId('exercise-bench-press').locator('[data-testid^="set-row-"]').first();
  const id = (await firstRow.getAttribute('data-testid'))!.replace('set-row-', '');
  await expect(page.getByTestId(`weight-${id}`)).toHaveValue('80');
  await expect(page.getByTestId(`reps-${id}`)).toHaveValue('8');
  // apply the suggestion, then beat it (9 reps) → PR
  await page.getByTestId('apply-suggestion-bench-press').click();
  const third = page.getByTestId('exercise-bench-press').locator('[data-testid^="set-row-"]').nth(2);
  const thirdId = (await third.getAttribute('data-testid'))!.replace('set-row-', '');
  await expect(page.getByTestId(`reps-${thirdId}`)).toHaveValue('8');
  await page.getByTestId(`reps-${id}`).fill('9');
  await page.getByTestId(`complete-${id}`).click();
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('finish-workout').click();
  await expect(page.getByTestId('pr-list')).toBeVisible();
});
