import { expect, test, type Browser, type Page } from '@playwright/test';
import { completeOnboarding } from './helpers';

/**
 * Runs against the web build connected to the local Supabase stack
 * (`npm run db:start` + `npm run build:web:backend`).
 */
const run = Date.now().toString(36);
const pw = 'Sicher12345!';

async function register(page: Page, name: string, email: string) {
  await completeOnboarding(page, { name });
  await page.goto('/settings/account');
  await page.getByTestId('go-signup').click();
  await page.getByTestId('auth-email').fill(email);
  await page.getByTestId('auth-password').fill(pw);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByTestId('home-screen')).toBeVisible();
}

async function syncNow(page: Page) {
  await page.goto('/settings/account');
  await page.getByTestId('sync-now').click();
  await expect(page.getByText(/Status: synchronisiert/)).toBeVisible();
  await expect(page.getByText('Änderungen ausstehend')).toHaveCount(0);
}

async function newPage(browser: Browser) {
  const ctx = await browser.newContext({ ...test.info().project.use });
  return ctx.newPage();
}

test('register from guest mode, sync and restore on a second device', async ({ page, browser }) => {
  const email = `anna-${run}@example.com`;
  await register(page, 'Anna', email);
  await page.goto('/body/weight');
  await page.getByTestId('weight-input').fill('70,5');
  await page.getByTestId('save-weight').click();
  await syncNow(page);
  await expect(page.getByTestId('account-email')).toHaveText(email);

  // second device: fresh storage → sign in → data is restored
  const b = await newPage(browser);
  await b.goto('/');
  await b.getByTestId('onboarding-login').click();
  await b.getByTestId('auth-email').fill(email);
  await b.getByTestId('auth-password').fill(pw);
  await b.getByTestId('auth-submit').click();
  await expect(b.getByTestId('home-screen')).toBeVisible();
  await expect(b.getByText('Anna 👋', { exact: false })).toBeVisible();
  await expect(b.getByTestId('home-weight-card')).toContainText('70,5 kg');

  // edits made offline-first on device B propagate to device A
  await b.goto('/nutrition/quick?meal=dinner');
  await b.getByTestId('quick-kcal').fill('555');
  await b.getByTestId('quick-save').click();
  await syncNow(b);
  await syncNow(page);
  await page.goto('/nutrition');
  await expect(page.getByTestId('meal-dinner')).toContainText('555 kcal');

  // wrong password is rejected with a German message
  const c = await newPage(browser);
  await c.goto('/auth?mode=signin');
  await c.getByTestId('auth-email').fill(email);
  await c.getByTestId('auth-password').fill('falsch123456');
  await c.getByTestId('auth-submit').click();
  await expect(c.getByTestId('auth-error')).toHaveText('E-Mail oder Passwort ist falsch.');
});

test('friends: request, accept, leaderboard and privacy settings are enforced', async ({ page, browser }) => {
  const a = page;
  await register(a, 'Ada', `ada-${run}@example.com`);
  await a.getByTestId('tab-community').click();
  await a.getByTestId('username-input').fill(`ada_${run}`);
  await a.getByTestId('save-username').click();
  await expect(a.getByTestId('community-screen')).toBeVisible();

  const b = await newPage(browser);
  await register(b, 'Bob', `bob-${run}@example.com`);
  // Bob logs steps so there is something to compare
  await b.goto('/checkin');
  await b.getByTestId('steps-input').fill('12345');
  await b.getByTestId('submit-checkin').click();
  await syncNow(b);
  await b.goto('/community');
  await b.getByTestId('username-input').fill(`bob_${run}`);
  await b.getByTestId('save-username').click();
  await b.getByTestId('community-tab-friends').click();
  await b.getByTestId('friend-search').fill(`ada_${run}`);
  await b.getByTestId(`add-friend-ada_${run}`).click();

  // Ada accepts
  await a.goto('/community');
  await a.getByTestId('community-tab-friends').click();
  await a.getByTestId(`accept-bob_${run}`).click();
  await expect(a.getByTestId(`friend-bob_${run}`)).toBeVisible();

  // leaderboard shows both, Bob's steps are visible (shared by default)
  await a.getByTestId('community-tab-leaderboard').click();
  await a.getByTestId('lb-steps').click();
  await expect(a.getByTestId('leaderboard')).toContainText('Bob');
  await expect(a.getByTestId('leaderboard')).toContainText('12.345');

  // friend profile: steps visible, weight private by default
  await a.getByTestId(`community-tab-friends`).click();
  await a.getByTestId(`friend-bob_${run}`).click();
  await expect(a.getByTestId('friend-week-steps')).toHaveText('12.345');
  await expect(a.getByText('Freigegebene Körper- & Ernährungsdaten')).toHaveCount(0);

  // Bob stops sharing steps → Ada only sees "privat"
  await b.goto('/settings/privacy');
  await b.getByTestId('privacy-steps').locator('input').click();
  await syncNow(b);
  await a.reload();
  await expect(a.getByTestId('friend-week-steps')).toHaveText('🔒 privat');

  // private challenge with invite
  await a.goto('/community');
  await a.getByTestId('community-tab-challenges').click();
  await a.getByTestId('new-challenge').click();
  await a.getByTestId('challenge-title').fill('Trainings-Duell');
  await a.getByText('Trainings', { exact: true }).click();
  await a.getByText('🏋️ Bob', { exact: false }).or(a.getByText('💪 Bob', { exact: false })).first().click();
  await a.getByTestId('create-challenge').click();
  await expect(a.getByTestId('challenge-Trainings-Duell')).toBeVisible();
  await b.goto('/community');
  await b.getByTestId('community-tab-challenges').click();
  await b.getByTestId('join-Trainings-Duell').click();
  await b.getByTestId('challenge-Trainings-Duell').click();
  await expect(b.getByTestId('challenge-detail')).toContainText('Ada');
});

test('account deletion removes server data', async ({ page, browser }) => {
  const email = `del-${run}@example.com`;
  await register(page, 'Del', email);
  await syncNow(page);
  await page.goto('/settings/account');
  await page.getByTestId('delete-confirm').fill('LÖSCHEN');
  await page.getByTestId('delete-account').click();
  await expect(page.getByTestId('onboarding-start')).toBeVisible();
  const b = await newPage(browser);
  await b.goto('/auth?mode=signin');
  await b.getByTestId('auth-email').fill(email);
  await b.getByTestId('auth-password').fill(pw);
  await b.getByTestId('auth-submit').click();
  await expect(b.getByTestId('auth-error')).toHaveText('E-Mail oder Passwort ist falsch.');
});
