import { describe, expect, it } from "vitest"
import { tokens } from "../tokens"

describe("tokens — P17.1 blue theme", () => {
  it("uses blue as the primary brand colour", () => {
    expect(tokens.color.brand[600]).toBe("#2563eb")
    expect(tokens.color.brand[700]).toBe("#1d4ed8")
    expect(tokens.color.brand.gradient).toContain("#2563eb")
  })

  it("defines the navy scale used by the sidebar", () => {
    expect(tokens.color.navy[800]).toBe("#0f1b2d")
    expect(tokens.color.navy[950]).toBe("#050a15")
  })

  it("keeps burnt orange solely in the high-severity semantic", () => {
    expect(tokens.color.severity.high.light).toBe("#ea580c")
    // Brand must not carry the old orange values.
    expect(JSON.stringify(tokens.color.brand)).not.toContain("ea580c")
    expect(JSON.stringify(tokens.color.brand)).not.toContain("f97316")
  })

  it("exposes refined semantic colours", () => {
    expect(tokens.color.success.light).toBe("#059669")
    expect(tokens.color.warning.light).toBe("#d97706")
    expect(tokens.color.danger.light).toBe("#dc2626")
    expect(tokens.color.info.light).toBe("#2563eb")
  })

  it("aligns the focus ring with the brand blue", () => {
    expect(tokens.color.focus.light).toBe("#2563eb")
    expect(tokens.color.focus.dark).toBe("#3b82f6")
    expect(tokens.ring).toContain("37,99,235")
  })
})
