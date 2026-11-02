import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const AUTH_FILE = 'playwright/.auth/superadmin.json';
const API_URL   = process.env.E2E_API_URL ?? 'http://localhost:8000';

setup('authenticate as super_admin', async ({ page, request }) => {
  // 1) تحقق من صحة الباك-إند
  const health = await request.get(`${API_URL}/healthz/`);
  expect(health.ok(), 'backend must be up').toBeTruthy();

  // 2) Login via UI
  await page.goto('/login');
  await page.getByLabel(/email|بريد/i).fill('admin@local.dev');
  await page.getByLabel(/password|كلمة/i).fill('AdminTest2026!');
  await page.getByRole('button', { name: /تسجيل|تسجيل الدخول|دخول|login|sign in/i }).click();

  // 3) انتظر الانتقال
  await expect(page).toHaveURL(/\/(staff|dashboard)/, { timeout: 10_000 });

  // 4) احفظ session
  await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
