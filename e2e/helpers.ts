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
