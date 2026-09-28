import { test } from '@playwright/test';
import { completeOnboarding } from './helpers';

/** Visual QA screenshots with demo data. Run: VISUAL=1 npx playwright test e2e/visual.spec.ts --project=local */
test.skip(!process.env.VISUAL, 'visual screenshots only on demand');

test('screens with demo data', async ({ page }) => {
  const out = process.env.SHOT_DIR ?? '/tmp/claude-0/shots';
  await completeOnboarding(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/settings');
  await page.getByTestId('load-demo').click();
  await page.waitForTimeout(1500);
  const shot = async (path: string, name: string, full = true) => {
    await page.goto(path);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
  };
  await shot('/', 'home');
  await shot('/training', 'training');
  await shot('/nutrition', 'nutrition');
  await shot('/progress', 'progress');
  await shot('/body/weight', 'weight');
  await shot('/achievements', 'achievements');
  await shot('/coach/report', 'report');
  await shot('/exercises/bench-press', 'exercise-bench');
  await shot('/community', 'community');
  await shot('/checkin', 'checkin');
  await page.goto('/training');
  await page.getByTestId('start-day-Oberkörper A').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${out}/workout.png`, fullPage: true });
});
