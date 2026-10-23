/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react-dom/test-utils"

vi.mock("../lib/api", () => ({
  api: {
    getSubscription: vi.fn(),
    getBillingUsage: vi.fn(),
    getOrgUsage: vi.fn(),
    cancelSubscription: vi.fn(),
    resumeSubscription: vi.fn(),
  },
}))

import { render } from "../test/render"
import Billing from "../../app/(tabs)/billing"

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

const usage = {
  scans: { used: 0, limit: 10 },
  monitored_emails: { used: 0, limit: 1 },
  password_entries: { used: 0, limit: 5 },
  two_factor_entries: { used: 0, limit: 3 },
  family_members: { used: 0, limit: 0 },
  awareness_sessions: { used: 0, limit: 3 },
  ai_requests: { used: 0, limit: 0 },
}

describe("Org billing", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    window.localStorage.setItem("amanak.context", "org-1")
    const { api } = await import("../lib/api")
    ;(api.getSubscription as any).mockResolvedValue({
      plan: { name_en: "Free" },
      status: "active",
      period: "monthly",
      current_period_start: "",
      current_period_end: "2026-12-01T00:00:00Z",
      cancel_at_period_end: false,
    })
    ;(api.getBillingUsage as any).mockResolvedValue(usage)
    ;(api.getOrgUsage as any).mockResolvedValue({
      plan: "business",
      members: { used: 5, limit: 10 },
      devices: { used: 12, limit: -1 },
      incidents: { used: 3, limit: -1 },
      ai_requests: { used: 120, limit: 2000 },
    })
  })

  it("renders org usage section", async () => {
    const rendered = render(<Billing />)
    await flush()
    expect(rendered.text()).toContain("Organization billing")
    expect(rendered.text()).toContain("5 / 10")
    rendered.unmount()
  })
})
