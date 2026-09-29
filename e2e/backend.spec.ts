import { expect, test, type Browser, type Page } from '@playwright/test';
import { completeOnboarding, mockGemini } from './helpers';

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
  // a catalog activity (not just walk/jog/run/EMS) syncs too
  await page.goto('/cardio/new?activity=padel');
  await page.getByTestId('cardio-save').click();
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
  await b.getByTestId('tab-training').click();
  await expect(b.getByTestId('cardio-entry')).toContainText('Padel');

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
  await mockGemini(a);
  await register(a, 'Ada', `ada-${run}@example.com`);
  await a.getByTestId('tab-community').click();
  await a.getByTestId('username-input').fill(`ada_${run}`);
  await a.getByTestId('save-username').click();
  await expect(a.getByTestId('community-screen')).toBeVisible();

  const b = await newPage(browser);
  const bobGoogle = await mockGemini(b);
  await register(b, 'Bob', `bob-${run}@example.com`);
  // Bob logs steps so there is something to compare
  await b.goto('/checkin');
  await b.getByTestId('steps-input').fill('12345');
  await b.getByTestId('submit-checkin').click();
  // privacy by default: only streaks + "zuletzt online" are shared → Bob opts in to share steps
  await b.goto('/settings/privacy');
  await expect(b.getByTestId('privacy-steps').locator('input')).not.toBeChecked();
  await expect(b.getByTestId('privacy-online').locator('input')).toBeChecked();
  await b.getByTestId('privacy-steps').locator('input').click();
  await syncNow(b);
  await b.goto('/community');
  await b.getByTestId('username-input').fill(`bob_${run}`);
  await b.getByTestId('save-username').click();
  await b.getByTestId('community-tab-friends').click();
  await b.getByTestId('friend-search').fill(`ada_${run}`);
  await b.getByTestId(`add-friend-ada_${run}`).click();
  // Bob sets a fun status → saved on the server, the screen closes
  await b.goto('/status');
  await b.getByTestId('status-preset-🥤').click();
  await expect(b.getByTestId('status-screen')).toHaveCount(0);

  // Ada accepts
  await a.goto('/community');
  await a.getByTestId('community-tab-friends').click();
  await a.getByTestId(`accept-bob_${run}`).click();
  await expect(a.getByTestId(`friend-bob_${run}`)).toBeVisible();
  await expect(a.getByTestId(`friend-status-bob_${run}`)).toHaveText('🥤 Monster Zero White intus – Pump incoming');

  // coach briefing on Home shows when the tester was last online
  await a.getByTestId('tab-index').click();
  await expect(a.getByTestId('briefing-friends')).toContainText('Bob');
  await expect(a.getByTestId('briefing-friends')).toContainText('gerade online');
  await expect(a.getByTestId('briefing-friend-status')).toContainText('🥤 Monster Zero White intus');

  // one Gemini key for the group: Ada stores and shares it, Bob gets AI without entering anything
  await a.goto('/settings/ai');
  await a.getByTestId('ai-key-input').fill('AIzaSyGroupKey00000000000000000grp1');
  await a.getByTestId('ai-key-save').click();
  await expect(a.getByTestId('ai-key-status')).toContainText('…grp1');
  await a.getByTestId('ai-share').click();
  await expect(a.getByTestId('ai-share-status')).toContainText('Freigegeben');
  await b.goto('/settings/ai');
  await expect(b.getByTestId('ai-shared-active')).toContainText('Ada');
  await b.goto('/coach');
  await b.getByTestId('coach-input').fill('Was steht heute an?');
  await b.getByTestId('coach-send').click();
  await expect(b.getByTestId('coach-msg-assistant').last()).toContainText('KI-Antwort');
  expect(bobGoogle.calls.at(-1)!.key).toBe('AIzaSyGroupKey00000000000000000grp1');
  // clean up: the shared key is global, later runs need a free slot
  await a.goto('/settings/ai');
  await a.getByTestId('ai-share-stop').click();
  await expect(a.getByTestId('ai-share')).toBeVisible();

  await a.goto('/community');

  // leaderboard shows both, Bob's steps are visible (Bob opted in)
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
  await b.getByTestId('privacy-online').locator('input').click();
  await syncNow(b);
  await a.reload();
  await expect(a.getByTestId('friend-week-steps')).toHaveText('🔒 privat');
  await a.goto('/');
  await expect(a.getByTestId('briefing-friends')).toContainText('nicht geteilt');

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

test('offline logging is kept locally and synced when back online', async ({ page, browser, context }) => {
  const email = `offline-${run}@example.com`;
  await register(page, 'Olli', email);
  await syncNow(page);
  await page.goto('/');
  await expect(page.getByTestId('home-screen')).toBeVisible();
  await context.setOffline(true);
  // in-app navigation only (no page loads while offline)
  await page.getByTestId('tab-nutrition').click();
  await page.getByTestId('add-dinner').click();
  await page.getByTestId('action-quick').click();
  await page.getByTestId('quick-kcal').fill('777');
  await page.getByTestId('quick-save').click();
  await expect(page.getByTestId('meal-dinner')).toContainText('777 kcal');
  await page.getByTestId('tab-index').click();
  await page.getByTestId('open-settings').click();
  await page.getByTestId('settings-account').click();
  await page.getByTestId('sync-now').click();
  await expect(page.getByText(/offline – Änderungen werden später übertragen/)).toBeVisible();
  await expect(page.getByText(/Änderungen ausstehend/)).toBeVisible();

  await context.setOffline(false);
  await page.getByTestId('sync-now').click();
  await expect(page.getByText(/Status: synchronisiert/)).toBeVisible();
  await expect(page.getByText('Änderungen ausstehend')).toHaveCount(0);

  const b = await newPage(browser);
  await b.goto('/auth?mode=signin');
  await b.getByTestId('auth-email').fill(email);
  await b.getByTestId('auth-password').fill(pw);
  await b.getByTestId('auth-submit').click();
  await expect(b.getByTestId('home-screen')).toBeVisible();
  await b.getByTestId('tab-nutrition').click();
  await expect(b.getByTestId('meal-dinner')).toContainText('777 kcal');
});

test('progress photo is uploaded to the private bucket and visible on a second device', async ({ page, browser }) => {
  const email = `foto-${run}@example.com`;
  await register(page, 'Fia', email);
  await page.goto('/');
  const jpeg = await page.screenshot({ type: 'jpeg', quality: 60, clip: { x: 0, y: 0, width: 120, height: 160 } });
  await page.goto('/body/photos');
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('photo-gallery').click();
  await (await chooser).setFiles({ name: 'front.jpg', mimeType: 'image/jpeg', buffer: jpeg });
  await expect(page.getByTestId('photo-image')).toHaveCount(1);
  await expect(page.getByTestId('photo-uploaded')).toBeVisible();
  await syncNow(page);

  // second device: row synced, image loads through a signed URL from private storage
  const b = await newPage(browser);
  await b.goto('/auth?mode=signin');
  await b.getByTestId('auth-email').fill(email);
  await b.getByTestId('auth-password').fill(pw);
  await b.getByTestId('auth-submit').click();
  await expect(b.getByTestId('home-screen')).toBeVisible();
  await b.goto('/body/photos');
  const img = b.getByTestId('photo-image').locator('img');
  await expect(img).toHaveAttribute('src', /\/storage\/v1\/object\/sign\/progress-photos\//);
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);

  // without a session the object is not publicly reachable
  const path = (await img.getAttribute('src'))!.split('/sign/')[1].split('?')[0];
  const res = await b.request.get(`http://127.0.0.1:54321/storage/v1/object/public/${path}`);
  expect(res.ok()).toBe(false);

  // GDPR: deleting the account also removes the stored photo
  const signed = (await img.getAttribute('src'))!;
  expect((await b.request.get(signed)).ok()).toBe(true);
  await b.goto('/settings/account');
  await b.getByTestId('delete-confirm').fill('LÖSCHEN');
  await b.getByTestId('delete-account').click();
  await expect(b.getByTestId('onboarding-start')).toBeVisible();
  expect((await b.request.get(signed)).ok()).toBe(false);
});

test('invite link / QR: a new user becomes a friend right after sign-up', async ({ page, browser }) => {
  const a = page;
  await register(a, 'Ina', `ina-${run}@example.com`);
  await a.goto('/community/invite');
  const link = (await a.getByTestId('invite-url').textContent())!;
  expect(link).toMatch(/\/invite\?c=[0-9a-f]{12}$/);
  await expect(a.getByTestId('invite-qr').locator('path')).toHaveCount(1);

  // Carl opens the link on his phone (no app yet)
  const c = await newPage(browser);
  await c.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await expect(c.getByTestId('invite-from')).toHaveText('Ina lädt dich ein');
  await c.getByTestId('invite-start').click();
  await completeOnboarding(c, { name: 'Carl' });
  await expect(c.getByTestId('invite-pending')).toContainText('Ina hat dich eingeladen');
  await c.getByTestId('invite-pending-signup').click();
  await c.getByTestId('auth-email').fill(`carl-${run}@example.com`);
  await c.getByTestId('auth-password').fill(pw);
  await c.getByTestId('auth-submit').click();
  await expect(c.getByTestId('home-screen')).toBeVisible();
  await expect(c.getByTestId('invite-joined')).toContainText('Du und Ina seid jetzt Freunde');
  await expect(c.getByTestId('briefing-friends')).toContainText('Ina');

  // Ina sees Carl without accepting anything; renewing the link invalidates the old one
  await a.goto('/');
  await a.getByTestId('tab-community').click();
  await a.getByTestId('username-input').fill(`ina_${run}`);
  await a.getByTestId('save-username').click();
  await a.getByTestId('community-tab-friends').click();
  await expect(a.getByTestId('community-screen')).toContainText('Carl');
  await a.goto('/community/invite');
  a.once('dialog', (d) => d.accept());
  await a.getByTestId('invite-renew').click();
  await expect(a.getByTestId('invite-url')).not.toHaveText(link);
  await c.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  await expect(c.getByTestId('invite-invalid')).toBeVisible();
});
