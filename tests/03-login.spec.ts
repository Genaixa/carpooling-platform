import { test, expect } from '@playwright/test';

/**
 * Login page — checks UI behaviour without real credentials.
 */

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#login');
    await expect(page.locator('input[placeholder*="email" i]')).toBeVisible();
  });

  test('shows error for wrong credentials', async ({ page }) => {
    await page.fill('input[placeholder*="email" i]', 'fake@example.com');
    await page.fill('input[type="password"]', 'WrongPassword1');
    await page.locator('button[type="submit"]').click();
    // Supabase returns invalid credentials — should show error toast or message
    await expect(page.locator('text=/invalid|incorrect|wrong|not found/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('navigate to register from login', async ({ page }) => {
    await page.locator('button', { hasText: /register|sign up|create/i }).click();
    await expect(page).toHaveURL(/#register/);
  });

  test('forgot password link is visible', async ({ page }) => {
    await expect(page.locator('text=/forgot.*password|reset.*password/i').first()).toBeVisible();
  });
});
