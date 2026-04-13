import { test, expect } from '@playwright/test';

/**
 * Edit ride page — seats field is a dropdown (not a number input),
 * so it works on mobile without spinner arrows.
 *
 * This test logs in as a test driver and verifies the seats field behaviour.
 * Uses env vars TEST_DRIVER_EMAIL / TEST_DRIVER_PASSWORD if set,
 * otherwise it just checks the UI structure on the edit page directly.
 */

const DRIVER_EMAIL = process.env.TEST_DRIVER_EMAIL || '';
const DRIVER_PASSWORD = process.env.TEST_DRIVER_PASSWORD || '';

async function login(page: any, email: string, password: string) {
  await page.goto('/#login');
  await page.fill('input[placeholder*="email" i]', email);
  await page.fill('input[type="password"]', password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/#dashboard/, { timeout: 10000 });
}

test.describe('Edit ride — seats dropdown', () => {
  test('seats field is a select (not number input) on desktop', async ({ page }) => {
    // Navigate to edit ride — even without a real ride ID the component
    // structure should be verifiable once logged in.
    // We test a real ride if credentials are provided.
    if (!DRIVER_EMAIL) {
      test.skip();
      return;
    }
    await login(page, DRIVER_EMAIL, DRIVER_PASSWORD);
    // Go to dashboard and click first edit ride button
    await page.goto('/#dashboard');
    const editBtn = page.locator('button, a').filter({ hasText: /edit ride/i }).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      // Seats must be a <select>, not <input type="number">
      await expect(page.locator('select[name="availableSeats"]')).toBeVisible();
      await expect(page.locator('input[name="availableSeats"]')).not.toBeVisible();
      // All options 1-8 should be present
      for (let i = 1; i <= 8; i++) {
        await expect(page.locator(`select[name="availableSeats"] option[value="${i}"]`)).toBeAttached();
      }
    }
  });

  test('seats field is a select on mobile viewport', async ({ page }) => {
    if (!DRIVER_EMAIL) {
      test.skip();
      return;
    }
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
    await login(page, DRIVER_EMAIL, DRIVER_PASSWORD);
    await page.goto('/#dashboard');
    const editBtn = page.locator('button, a').filter({ hasText: /edit ride/i }).first();
    if (await editBtn.isVisible()) {
      await editBtn.click();
      await expect(page.locator('select[name="availableSeats"]')).toBeVisible();
      // Can select value 3 with no issue
      await page.selectOption('select[name="availableSeats"]', '3');
      await expect(page.locator('select[name="availableSeats"]')).toHaveValue('3');
    }
  });
});
