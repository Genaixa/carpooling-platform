import { test, expect } from '@playwright/test';

/**
 * Home page search — checks the ride search form works.
 */

test.describe('Home page search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('from/to dropdowns are present', async ({ page }) => {
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('searching shows results or empty state', async ({ page }) => {
    // Select from/to locations
    const selects = page.locator('select');
    const count = await selects.count();
    if (count >= 2) {
      await selects.nth(0).selectOption({ index: 1 });
      await selects.nth(1).selectOption({ index: 2 });
    }
    // Click search button
    const searchBtn = page.locator('button').filter({ hasText: /search|find/i }).first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
      // Either rides appear or "no rides" message
      await expect(
        page.locator('text=/no rides|available|result/i').first()
      ).toBeVisible({ timeout: 8000 });
    }
  });

  test('search results show rides or empty state', async ({ page }) => {
    const selects = page.locator('select');
    const count = await selects.count();
    if (count >= 2) {
      await selects.nth(0).selectOption({ index: 1 });
      await selects.nth(1).selectOption({ index: 2 });
    }
    const searchBtn = page.locator('button').filter({ hasText: /search|find/i }).first();
    if (await searchBtn.isVisible()) {
      await searchBtn.click();
      // Either ride cards appear or the empty state message is shown
      await expect(
        page.locator('text=/No rides available|No rides match/i').first()
          .or(page.locator('button').filter({ hasText: /book|select seat/i }).first())
      ).toBeVisible({ timeout: 10000 });
    }
  });
});
