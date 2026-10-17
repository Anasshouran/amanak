import { test, expect } from "./fixtures"

test("theme defaults to light, toggles to dark, and persists", async ({ page }) => {
  await page.goto("/login")
  const html = page.locator("html")

  await expect(html).toHaveAttribute("data-theme", "light")
  await page.getByRole("button", { name: "تبديل المظهر" }).click()
  await expect(html).toHaveAttribute("data-theme", "dark")

  await page.reload()
  await expect(html).toHaveAttribute("data-theme", "dark")
})

test("locale defaults to Arabic, toggles to English, and persists", async ({ page }) => {
  await page.goto("/login")
  const html = page.locator("html")

  await expect(html).toHaveAttribute("lang", "ar")
  await page.getByRole("button", { name: "تغيير اللغة" }).click()
  await expect(html).toHaveAttribute("lang", "en")

  await page.reload()
  await expect(html).toHaveAttribute("lang", "en")
})

test("direction is rtl in Arabic and ltr in English", async ({ page }) => {
  await page.goto("/login")
  const html = page.locator("html")

  await expect(html).toHaveAttribute("dir", "rtl")
  await page.getByRole("button", { name: "تغيير اللغة" }).click()
  await expect(html).toHaveAttribute("dir", "ltr")
})
