import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/firestore.googleapis.com/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/identitytoolkit.googleapis.com/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ idToken: 'fake', localId: 'anon-user' }) });
  });
});

test('recommend page sign-in gate for anonymous user', async ({ page }) => {
  await page.goto('/recommend');
  await page.waitForTimeout(1500);
  await expect(page).toHaveScreenshot('recommend-signin-gate.png', { fullPage: true });
});
