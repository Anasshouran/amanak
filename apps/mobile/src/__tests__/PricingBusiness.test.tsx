/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react-dom/test-utils"

vi.mock("../lib/api", () => ({
  api: {
    getPlans: vi.fn(),
    getSubscription: vi.fn(),
    changePlan: vi.fn(),
  },
}))

import { render } from "../test/render"
import Pricing from "../../app/(tabs)/pricing"

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function clickByText(container: HTMLElement, needle: string) {
  const nodes = Array.from(container.querySelectorAll('[role="button"]'))
  const target = nodes.find((n) => (n.textContent ?? "").includes(needle))
  if (!target) throw new Error(`no button containing ${needle}`)
  act(() => {
    ;(target as HTMLElement).click()
  })
}

const plans = [
  { id: "free", name_en: "Free", name_ar: "مجاني", price_monthly: 0, price_yearly: 0, currency: "USD", limits: { scans_per_month: 10 }, is_active: true, sort_order: 1 },
  { id: "business", name_en: "Business", name_ar: "الأعمال", price_monthly: 0, price_yearly: 0, currency: "USD", limits: {}, is_active: true, sort_order: 4 },
  { id: "enterprise", name_en: "Enterprise", name_ar: "المؤسسات", price_monthly: null, price_yearly: null, currency: "USD", limits: {}, is_active: true, sort_order: 5 },
]

describe("Pricing business cards", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { api } = await import("../lib/api")
    ;(api.getPlans as any).mockResolvedValue(plans)
    ;(api.getSubscription as any).mockResolvedValue({ plan: { id: "free" } })
  })

  it("renders Business card with Coming soon", async () => {
    const rendered = render(<Pricing />)
    await flush()
    clickByText(rendered.container, "Refresh")
    await flush()
    expect(rendered.text()).toContain("Business")
    expect(rendered.text()).toContain("Coming soon")
    rendered.unmount()
  })

  it("renders Enterprise card with Contact sales", async () => {
    const rendered = render(<Pricing />)
    await flush()
    clickByText(rendered.container, "Refresh")
    await flush()
    expect(rendered.text()).toContain("Enterprise")
    expect(rendered.text()).toContain("Contact sales")
    rendered.unmount()
  })
})
