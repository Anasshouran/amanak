import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { vi } from "vitest"
import { Pricing } from "./Pricing"
import { api } from "../lib/api"

vi.mock("../lib/api", () => ({
  api: {
    getPlans: vi.fn(),
    getSubscription: vi.fn(),
  },
}))

vi.mock("../design/ThemeProvider", () => ({
  useTheme: () => ({ locale: "en" }),
}))

describe("Pricing business cards", () => {
  it("renders Business + Enterprise cards", async () => {
    ;(api.getPlans as any).mockResolvedValue([
      { id: "free", name_en: "Free", name_ar: "مجاني", price_monthly: 0, price_yearly: 0, currency: "USD", limits: { scans_per_month: 10, monitored_emails: 1, password_entries: 5, two_factor_entries: 3, family_members: 0, ai_enabled: false, ai_requests_per_month: 0, awareness_sessions_per_month: 3, export_enabled: false, support_level: "community" }, is_active: true, sort_order: 1 },
      { id: "pro", name_en: "Pro", name_ar: "احترافي", price_monthly: 5, price_yearly: 50, currency: "USD", limits: { scans_per_month: -1, monitored_emails: 10, password_entries: -1, two_factor_entries: -1, family_members: 0, ai_enabled: true, ai_requests_per_month: 200, awareness_sessions_per_month: -1, export_enabled: true, support_level: "email" }, is_active: true, sort_order: 2 },
      { id: "family", name_en: "Family", name_ar: "عائلي", price_monthly: 10, price_yearly: 100, currency: "USD", limits: { scans_per_month: -1, monitored_emails: 25, password_entries: -1, two_factor_entries: -1, family_members: 5, ai_enabled: true, ai_requests_per_month: 500, awareness_sessions_per_month: -1, export_enabled: true, support_level: "priority" }, is_active: true, sort_order: 3 },
      { id: "business", name_en: "Business", name_ar: "الأعمال", price_monthly: 0, price_yearly: 0, currency: "USD", limits: { org_features: { max_members: 10 } }, is_active: true, sort_order: 4, audience: "business", is_available: true, price_note: "Coming soon" },
      { id: "enterprise", name_en: "Enterprise", name_ar: "المؤسسات", price_monthly: null, price_yearly: null, currency: "USD", limits: {}, is_active: true, sort_order: 5, audience: "enterprise", is_available: false, price_note: "Contact sales" },
    ])
    ;(api.getSubscription as any).mockResolvedValue({ plan: { id: "free" }, status: "active", period: "monthly", current_period_start: "", current_period_end: "", cancel_at_period_end: false })
    render(<Pricing />)
    expect(await screen.findByText(/Business/i)).toBeInTheDocument()
    expect(await screen.findByText(/Enterprise/i)).toBeInTheDocument()
  })

  it("shows Coming soon and Contact sales", async () => {
    ;(api.getPlans as any).mockResolvedValue([
      { id: "free", name_en: "Free", name_ar: "مجاني", price_monthly: 0, price_yearly: 0, currency: "USD", limits: { scans_per_month: 10, monitored_emails: 1, password_entries: 5, two_factor_entries: 3, family_members: 0, ai_enabled: false, ai_requests_per_month: 0, awareness_sessions_per_month: 3, export_enabled: false, support_level: "community" }, is_active: true, sort_order: 1 },
      { id: "business", name_en: "Business", name_ar: "الأعمال", price_monthly: 0, price_yearly: 0, currency: "USD", limits: { org_features: { max_members: 10 } }, is_active: true, sort_order: 4 },
      { id: "enterprise", name_en: "Enterprise", name_ar: "المؤسسات", price_monthly: null, price_yearly: null, currency: "USD", limits: {}, is_active: true, sort_order: 5 },
    ])
    ;(api.getSubscription as any).mockResolvedValue({ plan: { id: "free" }, status: "active", period: "monthly", current_period_start: "", current_period_end: "", cancel_at_period_end: false })
    render(<Pricing />)
    expect(await screen.findByText(/Coming soon/i)).toBeInTheDocument()
    expect((await screen.findAllByText(/Contact sales/i)).length).toBeGreaterThan(0)
  })
})
