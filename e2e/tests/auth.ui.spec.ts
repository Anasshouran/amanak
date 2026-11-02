import { test, expect } from '@playwright/test';

test.describe('Auth — UI level (authed)', () => {
  test('/staff/ai-settings renders (authenticated)', async ({ page }) => {
    await page.goto('/staff/ai-settings');
    await expect(page).toHaveURL(/\/staff\/ai-settings/, { timeout: 15000 });
    await expect(
      page.getByRole('heading', { name: /AI Provider Settings|ai settings|設定/i })
    ).toBeVisible({ timeout: 15000 });
  });
});
