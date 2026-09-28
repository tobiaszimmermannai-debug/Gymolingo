import { expect, test } from '@playwright/test';
import { completeOnboarding } from './helpers';

test('offline coach answers from real data and weekly report is generated automatically', async ({ page }) => {
  await completeOnboarding(page);
  // Photo AI is disabled in the zero-cost configuration → no dead button
  await page.goto('/nutrition/add?meal=lunch');
  await expect(page.getByTestId('action-quick')).toBeVisible();
  await expect(page.getByTestId('action-photo')).toHaveCount(0);

  await page.goto('/');
  await page.getByTestId('home-coach-card').click();
  await expect(page.getByTestId('coach-screen')).toBeVisible();
  await page.getByTestId('coach-suggestion-0').click(); // "Was trainiere ich heute?"
  const reply = page.getByTestId('coach-msg-assistant').last();
  await expect(reply).toContainText('Oberkörper A');
  await expect(reply).toContainText('Bankdrücken');
  await page.getByTestId('coach-input').fill('Wie viel Protein fehlt mir?');
  await page.getByTestId('coach-send').click();
  await expect(page.getByTestId('coach-msg-assistant').last()).toContainText('g Protein');
  await expect(page.getByText('aus deinen Daten').first()).toBeVisible();

  await page.getByTestId('open-report').click();
  await expect(page.getByTestId('report-screen')).toBeVisible();
  await expect(page.getByTestId('report-section')).toHaveCount(7);
  await expect(page.getByTestId('report-section').first()).toContainText('Kraftentwicklung');
});
