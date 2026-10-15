import { execFileSync } from "node:child_process"
import { expect, registerUser, test, testUser, useEnglish, refreshSession, waitForApiIdle } from "./fixtures"

/** Seed a few historical snapshots directly in the backend container. */
function seedScoreHistory(email: string): void {
  const container = process.env.E2E_BACKEND_CONTAINER || "amanak-local-backend-1"
  const script = [
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
  execFileSync(
    "docker",
    ["exec", container, "python", "backend/manage.py", "shell", "-c", script],
    { stdio: "ignore" },
  )
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
