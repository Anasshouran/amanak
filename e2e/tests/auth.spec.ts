import { test, expect } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8080';

test.describe('Auth — API level (authed)', () => {
  test('GET /api/v1/staff/ai-settings/ with super_admin → 200 JSON', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/staff/ai-settings/`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('provider');
    expect(body).toHaveProperty('model');
    expect(body).toHaveProperty('is_enabled');
    expect(body).toHaveProperty('cloud_consent');
  });
});

test.describe('Auth — UI level (authed)', () => {
  test('/staff/ai-settings renders (authenticated)', async ({ page }) => {
    await page.goto('/staff/ai-settings');
    await expect(page).toHaveURL(/\/staff\/ai-settings/);
    await expect(
      page.getByRole('heading', { name: /ai settings|إعدادات/i })
    ).toBeVisible({ timeout: 10_000 });
  });
});
