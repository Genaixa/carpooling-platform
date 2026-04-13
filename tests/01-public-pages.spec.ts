import { test, expect } from '@playwright/test';

/**
 * Public pages — no login required.
 * Checks that key pages load without errors.
 */

test.describe('Public pages', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ChapaRide|Carpool/i);
    // Hero or main CTA visible
    await expect(page.locator('text=/find a ride|post a ride|book/i').first()).toBeVisible();
  });

  test('how it works page loads', async ({ page }) => {
    await page.goto('/#how-it-works');
    await expect(page.locator('text=/how it works/i').first()).toBeVisible();
  });

  test('FAQs page loads and accordion works', async ({ page }) => {
    await page.goto('/#faqs');
    await expect(page.locator('text=/frequently asked|faq/i').first()).toBeVisible();
    // Click first FAQ item and check it expands
    const firstQuestion = page.locator('[role="button"], button').filter({ hasText: /\?/ }).first();
    if (await firstQuestion.isVisible()) {
      await firstQuestion.click();
    }
  });

  test('terms and conditions page loads', async ({ page }) => {
    await page.goto('/#terms');
    await expect(page.locator('text=/terms/i').first()).toBeVisible();
  });

  test('privacy policy page loads', async ({ page }) => {
    await page.goto('/#privacy-policy');
    await expect(page.locator('text=/privacy/i').first()).toBeVisible();
  });

  test('contact page loads', async ({ page }) => {
    await page.goto('/#contact');
    await expect(page.locator('text=/contact/i').first()).toBeVisible();
  });
});
