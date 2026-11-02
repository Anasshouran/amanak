import { test, expect } from '@playwright/test';

test.describe('AI Settings page', () => {
  test('renders AI settings page when authenticated', async ({ page }) => {
    await page.goto('/staff/ai-settings');
    await expect(page).toHaveURL(/\/staff\/ai-settings/, { timeout: 15000 });
    await expect(
      page.getByRole('heading', { name: /AI Provider Settings|ai settings|إعدادات/i })
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('radiogroup')).toBeVisible();
    await expect(page.getByRole('button', { name: /Save|حفظ/i })).toBeVisible();
  });
});
