import { test, expect } from '@playwright/test';

test.describe('AI Settings page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/staff/ai-settings');
    await expect(
      page.getByRole('heading', { name: /AI Provider Settings|ai settings|إعدادات/i })
    ).toBeVisible({ timeout: 15000 });
  });

  test('renders provider radio group', async ({ page }) => {
    await expect(page.getByRole('radiogroup')).toBeVisible();
  });

  test('renders save button', async ({ page }) => {
    const save = page.getByRole('button', { name: /Save|حفظ/i });
    await expect(save).toBeVisible();
  });
});
