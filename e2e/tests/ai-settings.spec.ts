import { test, expect } from '@playwright/test';

test.describe('AI Settings page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/staff/ai-settings');
    await expect(
      page.getByRole('heading', { name: /ai settings|إعدادات/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('renders provider + model fields', async ({ page }) => {
    await expect(page.getByLabel(/provider|المزود/i)).toBeVisible();
    await expect(page.getByLabel(/model|النموذج/i)).toBeVisible();
  });

  test('cloud consent toggle reflects current state', async ({ page }) => {
    const toggle = page.getByRole('switch', { name: /cloud consent|موافقة/i });
    await expect(toggle).toBeVisible();
    const state = await toggle.getAttribute('aria-checked');
    expect(['true', 'false']).toContain(state);
  });

  test('save button exists and is enabled', async ({ page }) => {
    const save = page.getByRole('button', { name: /save|حفظ/i });
    await expect(save).toBeVisible();
    await expect(save).toBeEnabled();
  });
});
