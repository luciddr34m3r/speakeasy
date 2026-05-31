import { test, expect } from '@playwright/test';

// Mock Firebase auth and Firestore to avoid real network calls
test.beforeEach(async ({ page }) => {
  // Intercept Firestore listen/read calls — return empty results
  await page.route('**/firestore.googleapis.com/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });
  await page.route('**/identitytoolkit.googleapis.com/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ idToken: 'fake', localId: 'anon-user' }) });
  });
});

test('root path loads the menu page', async ({ page }) => {
  await page.goto('/');
  // Should at minimum render the page without crashing
  await expect(page).toHaveURL('/');
  await expect(page.locator('body')).toBeVisible();
});

test('/admin shows a staff-only guard when unauthenticated', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.locator('body')).toBeVisible();
  // AdminGuard renders "Staff only." text
  await expect(page.getByText(/staff only/i)).toBeVisible({ timeout: 10_000 });
});

test('/recommend page loads', async ({ page }) => {
  await page.goto('/recommend');
  await expect(page.locator('body')).toBeVisible();
});

test('/signin page loads', async ({ page }) => {
  await page.goto('/signin');
  await expect(page.locator('body')).toBeVisible();
});
