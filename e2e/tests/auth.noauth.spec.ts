import { test, expect } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8080';

test.describe('Auth — API level (no auth)', () => {
  test('GET /api/v1/staff/ai-settings/ without token → 401', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/v1/staff/ai-settings/`);
    expect(res.status()).toBe(401);
  });
});

test.describe('Auth — UI level (no auth)', () => {
  test('unauthenticated visit to /staff/ai-settings → redirect to /login', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/staff/ai-settings');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await ctx.close();
  });
});
