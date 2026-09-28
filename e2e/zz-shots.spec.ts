import { test } from '@playwright/test';
import { completeOnboarding } from './helpers';
test('screenshots', async ({ page }) => {
  await completeOnboarding(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/claude-0/shot-home.png', fullPage: false });
  await page.getByTestId('start-workout').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/claude-0/shot-workout.png' });
});
