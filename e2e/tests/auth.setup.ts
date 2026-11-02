import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const AUTH_FILE = 'playwright/.auth/superadmin.json';
const API_URL   = process.env.E2E_API_URL ?? 'http://localhost:8080';

setup('authenticate as super_admin', async ({ page, request }) => {
  const health = await request.get(`${API_URL}/healthz/`);
  expect(health.ok(), 'backend must be up').toBeTruthy();

  await page.goto('/login');
  await page.getByLabel(/email|بريد/i).fill('admin@local.dev');
  await page.getByLabel(/password|كلمة/i).fill('AdminTest2026!');
  await page.getByRole('button', { name: /تسجيل|تسجيل الدخول|دخول|login|sign in|sign-in/i }).click();

  await expect(page).toHaveURL(/\/(staff|dashboard)/, { timeout: 15000 });

  await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
