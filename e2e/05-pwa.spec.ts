import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers';

test('PWA: manifest is linked and the app starts offline after the first visit', async ({ page, context }) => {
  await completeOnboarding(page, { name: 'Pia' });
  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifest).toBe('/manifest.webmanifest');
  const res = await page.request.get('/manifest.webmanifest');
  expect((await res.json()).display).toBe('standalone');

  // wait until the service worker controls the page, then reload once so all bundles pass through it
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await expect(page.getByText('Pia', { exact: false }).first()).toBeVisible();
  await context.setOffline(false);
});
