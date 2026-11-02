import { test, expect } from '@playwright/test';

test.describe('Auth — API level', () => {
  test('GET /api/v1/staff/ai-settings/ without token → 401', async ({ request }) => {
    const res = await request.get('/api/v1/staff/ai-settings/');
    expect(res.status()).toBe(401);
  });
});
