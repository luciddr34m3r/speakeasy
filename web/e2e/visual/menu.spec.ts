import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/firestore.googleapis.com/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/identitytoolkit.googleapis.com/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ idToken: 'fake', localId: 'anon-user' }) });
  });
});

test('menu page empty state visual', async ({ page }) => {
  await page.goto('/');
  // Wait for initial loading to settle — skeleton or empty state
  await page.waitForTimeout(2000);
  await expect(page).toHaveScreenshot('menu-empty.png', { fullPage: true });
});
