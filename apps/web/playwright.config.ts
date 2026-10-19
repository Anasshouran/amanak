import { defineConfig } from "@playwright/test"

const baseURL = process.env.E2E_BASE_URL || "http://localhost:5173"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testIgnore: [/scanner\.spec\.ts/, /2fa\.spec\.ts/, /mobile-screenshots\.spec\.ts/],
      use: {
        browserName: "chromium",
        launchOptions: {
          args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        },
      },
    },
    {
      name: "mobile-screenshots",
      testMatch: /mobile-screenshots\.spec\.ts/,
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        baseURL: process.env.E2E_MOBILE_BASE_URL || "http://localhost:8081",
        launchOptions: {
          args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        },
      },
    },
    {
      // The scanner flow registers a fresh user and hits the scan endpoint per
      // test. Running its tests concurrently (the global `fullyParallel`) made
      // the phishing assertion flake under worker contention, so this project
      // runs the file serially in a single worker.
      name: "scanner",
      testMatch: /scanner\.spec\.ts/,
      fullyParallel: false,
      workers: 1,
      retries: 2,
      use: {
        browserName: "chromium",
        launchOptions: {
          args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        },
      },
    },
    {
      name: "two-factor",
      testMatch: /2fa\.spec\.ts/,
      fullyParallel: false,
      workers: 1,
      retries: 2,
      use: {
        browserName: "chromium",
        launchOptions: {
          args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        },
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "VITE_API_URL=http://localhost:8080 npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
