import { describe, expect, it } from "vitest"
import { messages } from "../i18n"

describe("i18n key parity", () => {
  it("has the same keys in Arabic and English", () => {
    const en = Object.keys(messages.en).sort()
    const ar = Object.keys(messages.ar).sort()
    expect(ar).toEqual(en)
  })

  it("defines billing and awareness translations in both locales", () => {
    const required = [
      "nav.plans",
      "nav.awareness",
      "plans.title",
      "billing.title",
      "billing.usage",
      "usage.scans",
      "upgrade.title",
      "awareness.title",
    ]
    for (const key of required) {
      expect(messages.en[key]).toBeTruthy()
      expect(messages.ar[key]).toBeTruthy()
    }
  })
})
