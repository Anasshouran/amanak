import { describe, expect, it } from "vitest"
import type { Plan } from "@amanak/shared-types"
import {
  formatLimit,
  formatPrice,
  isIncluded,
  isUnlimited,
  usageEntry,
  usagePercent,
} from "../plan"

const t = (key: string) => key

const plan = (monthly: string, yearly: string): Plan => ({
  id: "pro",
  name_en: "Pro",
  name_ar: "احترافي",
  price_monthly: monthly,
  price_yearly: yearly,
  currency: "USD",
  limits: {
    scans_per_month: -1,
    monitored_emails: 10,
    password_entries: -1,
    two_factor_entries: -1,
    family_members: 0,
    ai_enabled: true,
    ai_requests_per_month: 200,
    awareness_sessions_per_month: -1,
    export_enabled: true,
    support_level: "email",
  },
  is_active: true,
})

describe("plan helpers", () => {
  it("identifies unlimited and included limits", () => {
    expect(isUnlimited(-1)).toBe(true)
    expect(isUnlimited(0)).toBe(false)
    expect(isIncluded(0)).toBe(false)
    expect(isIncluded(5)).toBe(true)
  })

  it("formats limits with translation keys", () => {
    expect(formatLimit(-1, t)).toBe("billing.unlimited")
    expect(formatLimit(0, t)).toBe("billing.not_included")
    expect(formatLimit(10, t)).toBe("10")
  })

  it("formats prices per period", () => {
    const p = plan("5.00", "50.00")
    expect(formatPrice(p, "monthly")).toBe("5.00")
    expect(formatPrice(p, "yearly")).toBe("50.00")
  })

  it("computes usage percentages", () => {
    expect(usagePercent({ used: 5, limit: 10 })).toBe(50)
    expect(usagePercent({ used: 20, limit: 10 })).toBe(100)
    expect(usagePercent({ used: 3, limit: -1 })).toBeNull()
    expect(usagePercent({ used: 0, limit: 0 })).toBe(0)
  })

  it("returns zeroed usage entries when data is missing", () => {
    expect(usageEntry(null, "scans")).toEqual({ used: 0, limit: 0 })
  })
})
