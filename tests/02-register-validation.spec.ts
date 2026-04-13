import { test, expect } from '@playwright/test';

/**
 * Registration form validation — tests that the form catches bad input
 * without actually creating real accounts.
 */

test.describe('Registration validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#register');
    await expect(page.locator('text=/create.*account|register/i').first()).toBeVisible();
  });

  test('numeric email like 12345@gmail.com is accepted', async ({ page }) => {
    await page.fill('[name="firstName"]', 'Test');
    await page.fill('[name="surname"]', 'User');
    await page.fill('[name="email"]', '12345@gmail.com');
    await page.fill('[name="confirmEmail"]', '12345@gmail.com');
    await page.fill('[name="phone"]', '07700900000');
    await page.fill('[name="addressLine1"]', '1 Test Street');
    await page.fill('[name="city"]', 'London');
    await page.fill('[name="postcode"]', 'SW1A 1AA');
    await page.fill('[name="country"]', 'United Kingdom');
    await page.selectOption('[name="gender"]', { index: 1 });
    await page.selectOption('[name="ageGroup"]', { index: 1 });
    await page.selectOption('[name="maritalStatus"]', { index: 1 });
    await page.fill('[name="password"]', 'Password123');
    await page.fill('[name="confirmPassword"]', 'Password123');
    // Check the terms checkbox
    await page.locator('input[type="checkbox"]').first().check();

    await page.locator('button[type="submit"]').click();

    // Should NOT show the phone-number-in-email-field error message
    await expect(page.locator('text=/email address, not a phone number/i')).not.toBeVisible();
    // Should NOT show invalid email error
    await expect(page.locator('text=/valid email address/i')).not.toBeVisible();
  });

  test('email fields have type=email (browser handles format validation)', async ({ page }) => {
    // The browser's native HTML5 validation blocks non-email values from submitting.
    // Our job here is just to confirm the inputs are typed correctly.
    await expect(page.locator('input[name="email"][type="email"]')).toBeAttached();
    await expect(page.locator('input[name="confirmEmail"][type="email"]')).toBeAttached();
  });

  test('rejects mismatched passwords', async ({ page }) => {
    await page.fill('[name="firstName"]', 'Test');
    await page.fill('[name="surname"]', 'User');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="confirmEmail"]', 'test@example.com');
    await page.fill('[name="phone"]', '07700900000');
    await page.fill('[name="addressLine1"]', '1 Test Street');
    await page.fill('[name="city"]', 'London');
    await page.fill('[name="postcode"]', 'SW1A 1AA');
    await page.fill('[name="country"]', 'United Kingdom');
    await page.selectOption('[name="gender"]', { index: 1 });
    await page.selectOption('[name="ageGroup"]', { index: 1 });
    await page.selectOption('[name="maritalStatus"]', { index: 1 });
    await page.fill('[name="password"]', 'Password123');
    await page.fill('[name="confirmPassword"]', 'DifferentPass');
    await page.locator('input[type="checkbox"]').first().check();
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('text=/password.*match|match.*password/i')).toBeVisible();
  });

  test('rejects phone number entered in email field', async ({ page }) => {
    await page.fill('[name="firstName"]', 'Test');
    await page.fill('[name="surname"]', 'User');
    await page.fill('[name="email"]', '07700900000');
    await page.fill('[name="confirmEmail"]', '07700900000');
    await page.locator('button[type="submit"]').click();
    // The phone-in-email check or invalid email check should fire
    await expect(page.locator('text=/phone number|valid email/i').first()).toBeVisible();
  });

  test('shows email mismatch indicator', async ({ page }) => {
    await page.fill('[name="email"]', 'user@example.com');
    await page.fill('[name="confirmEmail"]', 'different@example.com');
    await page.locator('[name="confirmEmail"]').blur();
    await expect(page.locator('text=/do not match/i')).toBeVisible();
  });
});
