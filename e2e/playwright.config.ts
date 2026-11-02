import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const API_URL  = process.env.E2E_API_URL  ?? 'http://localhost:8080';
const AUTH_FILE = path.join(process.cwd(), 'playwright', '.auth', 'superadmin.json');

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'api',
      testMatch: /auth\.api\.spec\.ts/,
      use: { baseURL: API_URL },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
      },
      dependencies: ['setup'],
      testMatch: /ai-settings\.spec\.ts|auth\.ui\.spec\.ts/,
      testIgnore: /unauth/,
    },
    {
      name: 'noauth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /unauth\.spec\.ts/,
    },
  ],
});
