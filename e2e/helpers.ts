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

/** width/height from a JPEG's SOF marker */
export function jpegSize(buf: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < buf.length) {
    const marker = buf.readUInt16BE(i);
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xffc0 && marker <= 0xffc3) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error('no SOF marker');
}
