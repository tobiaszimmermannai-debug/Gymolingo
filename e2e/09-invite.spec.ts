import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers';

test('share the app: QR code, WhatsApp and copy link (local mode = plain app link)', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await completeOnboarding(page);
  await page.getByTestId('tab-community').click();
  await page.getByTestId('open-invite').click();

  const url = `${baseURL}/`;
  await expect(page.getByTestId('invite-url')).toHaveText(url);
  await expect(page.getByTestId('invite-qr').locator('path')).toHaveCount(1);

  await page.evaluate(() => {
    (window as any).__opened = [];
    window.open = ((u: string) => ((window as any).__opened.push(u), {})) as typeof window.open;
  });
  await page.getByTestId('invite-whatsapp').click();
  const opened: string[] = await page.evaluate(() => (window as any).__opened);
  expect(opened[0]).toMatch(/^https:\/\/wa\.me\/\?text=/);
  expect(decodeURIComponent(opened[0])).toContain(url);

  await page.getByTestId('invite-copy').click();
  await expect(page.getByTestId('invite-copy')).toContainText('Link kopiert');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
});

test('invite link with an unknown code still lets you start', async ({ page }) => {
  await page.goto('/invite?c=abcdef123456');
  await expect(page.getByTestId('invite-from')).toHaveText('Willkommen bei Gymolingo');
  await page.getByTestId('invite-start').click();
  await expect(page.getByTestId('onboarding-start')).toBeVisible();
});
