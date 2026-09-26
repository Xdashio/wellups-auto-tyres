import { test, expect } from '@playwright/test';

test.describe('V0.6C Payment E2E', () => {
  test('placeholder payment flow', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Well Lups/);
  });
});
