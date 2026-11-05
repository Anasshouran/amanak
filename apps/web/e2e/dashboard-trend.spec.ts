import { execFileSync } from "node:child_process"
import { expect, registerUser, test, testUser, useEnglish, refreshSession, waitForApiIdle } from "./fixtures"

/** Seed a few historical snapshots directly in the backend. */
function seedScoreHistory(email: string): void {
  const backendDir = process.env.E2E_BACKEND_DIR || "../../backend"
  const env = {
    ...process.env,
    POSTGRES_HOST: process.env.POSTGRES_HOST || "127.0.0.1",
    POSTGRES_PORT: process.env.POSTGRES_PORT || "5433",
    POSTGRES_DB: process.env.POSTGRES_DB || "amanak",
    POSTGRES_USER: process.env.POSTGRES_USER || "amanak",
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD || "amanak-ci",
    DJANGO_DEBUG: "true",
    USE_POSTGRES: "true",
    DJANGO_SECRET_KEY: process.env.DJANGO_SECRET_KEY || "ci-secret-key",
    PYTHONPATH: `${backendDir}:${process.env.PYTHONPATH || ""}`,
  }
  const script = [
    "import os,django; os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings'); django.setup()",
    "from datetime import timedelta",
    "from django.utils import timezone",
    "from accounts.models import User",
    "from security_score.models import SecurityScore, SecurityScoreSnapshot",
    `u = User.objects.get(email=${JSON.stringify(email)})`,
    "SecurityScore.objects.update_or_create(user=u, defaults={'score': 80})",
    "today = timezone.localdate()",
    "for days_ago, value in [(95, 40), (6, 50), (2, 65), (0, 80)]:",
    "    SecurityScoreSnapshot.objects.update_or_create(user=u, date=today - timedelta(days=days_ago), defaults={'score': value})",
  ].join("\n")
  const container = process.env.E2E_BACKEND_CONTAINER || "amanak-local-backend-1"
  try {
    execFileSync("docker", ["exec", container, "python", "backend/manage.py", "shell", "-c", script], { stdio: "ignore" })
  } catch {
    const py = process.env.E2E_PYTHON || "python3"
    execFileSync(py, ["manage.py", "shell", "-c", script], { stdio: "ignore", cwd: backendDir, env })
  }
}

test.describe("dashboard security score trend", () => {
  test("shows an empty state until there is enough history", async ({ page }) => {
    const user = testUser()
    await useEnglish(page)
    await registerUser(page, user)
    await waitForApiIdle(page)

    await expect(page.getByRole("heading", { name: "Security score trend" })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText("Not enough data yet")).toBeVisible()
  })

  test("renders the chart and switches range", async ({ page }) => {
    const user = testUser()
    await useEnglish(page)
    await registerUser(page, user)
    await waitForApiIdle(page)

    seedScoreHistory(user.email)
    await refreshSession(page)

    await expect(page.getByRole("img", { name: /Security score trend/ })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.locator("table.sr-only tbody tr")).toHaveCount(30)

    await page.getByRole("tab", { name: "7 days" }).click()
    await expect(page.locator("table.sr-only tbody tr")).toHaveCount(7, { timeout: 10000 })

    await page.getByRole("tab", { name: "90 days" }).click()
    await expect(page.locator("table.sr-only tbody tr")).toHaveCount(90, { timeout: 10000 })
  })
})
