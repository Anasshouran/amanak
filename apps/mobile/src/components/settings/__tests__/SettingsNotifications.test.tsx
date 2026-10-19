/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react-dom/test-utils"
import { renderWithProviders } from "../../../test/render"
import { SettingsNotifications } from "../SettingsNotifications"

const apiMock = vi.hoisted(() => ({
  getNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
}))

vi.mock("../../../lib/api", () => ({ api: apiMock }))

const DEFAULTS = {
  security_alerts: true,
  breach_alerts: true,
  scan_results: true,
  family_activity: true,
  product_updates: false,
}

const LABELS = [
  "Security alerts",
  "Breach alerts",
  "Scan results",
  "Family activity",
  "Product updates",
]

async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  window.localStorage.setItem("amanak.locale", "en")
  apiMock.getNotificationPreferences.mockResolvedValue({ ...DEFAULTS })
  apiMock.updateNotificationPreferences.mockResolvedValue({ ...DEFAULTS })
})

describe("SettingsNotifications", () => {
  it("renders the five toggles once the preferences load", async () => {
    const rendered = renderWithProviders(<SettingsNotifications />)
    await flush()

    for (const label of LABELS) {
      expect(rendered.text()).toContain(label)
    }
    expect(rendered.container.querySelectorAll('input[type="checkbox"]').length).toBe(5)

    rendered.unmount()
  })

  it("PATCHes only the toggled preference", async () => {
    const rendered = renderWithProviders(<SettingsNotifications />)
    await flush()

    const boxes = rendered.container.querySelectorAll('input[type="checkbox"]')
    await act(async () => {
      ;(boxes[4] as HTMLInputElement).click()
    })

    expect(apiMock.updateNotificationPreferences).toHaveBeenCalledTimes(1)
    expect(apiMock.updateNotificationPreferences).toHaveBeenCalledWith({
      product_updates: true,
    })

    rendered.unmount()
  })
})
