import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers';

test('fun status: preset, custom text and removal', async ({ page }) => {
  await completeOnboarding(page);
  await expect(page.getByTestId('home-status')).toContainText('Status setzen');
  await page.getByTestId('home-status').click();

  // preset: without an account it stays on this device
  await page.getByTestId('status-preset-🥤').click();
  await expect(page.getByTestId('status-current')).toContainText('Monster Zero White intus');
  await expect(page.getByTestId('status-msg')).toContainText('Melde dich an');
  await page.getByTestId('back-button').click();
  await expect(page.getByTestId('home-status')).toContainText('Monster Zero White intus');
  await expect(page.getByTestId('home-status')).toContainText('🥤');

  // custom status, kept until changed
  await page.getByTestId('home-status').click();
  await page.getByTestId('status-duration-forever').click();
  await page.getByRole('button', { name: 'Emoji 🦍' }).click();
  await page.getByTestId('status-custom-text').fill('  Zweiter   Shake, gleiches Glück ');
  await page.getByTestId('status-custom-save').click();
  await expect(page.getByTestId('status-current')).toContainText('🦍 Zweiter Shake, gleiches Glück');
  await expect(page.getByTestId('status-current')).toContainText('bis du ihn änderst');

  await page.getByTestId('status-clear').click();
  await expect(page.getByTestId('status-current')).toContainText('Noch kein Status');
  await page.getByTestId('back-button').click();
  await expect(page.getByTestId('home-status')).toContainText('Status setzen');
});
