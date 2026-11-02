import { test, expect } from '@playwright/test';

test.describe('Auth — UI level (unauth)', () => {
  test('unauthenticated visit to /staff/ai-settings → redirect to /login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/staff/ai-settings');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    await ctx.close();
  });
});
