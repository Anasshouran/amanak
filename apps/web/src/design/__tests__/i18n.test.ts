import { describe, expect, it } from "vitest"
import { translate } from "../i18n"

describe("translate", () => {
  it("returns the localized string for a supported locale", () => {
    expect(translate("en", "login.title")).toBe("Sign in to AMANAK")
    expect(translate("ar", "login.title")).toBe("تسجيل الدخول إلى أمانك")
  })

  it("interpolates named variables", () => {
    const text = translate("en", "breach.summary", { checked: 4, new: 2, total: 6 })
    expect(text).toContain("4")
    expect(text).toContain("2")
    expect(text).toContain("6")
  })

  it("falls back to the key itself when a translation is missing", () => {
    expect(translate("en", "this.key.does.not.exist")).toBe("this.key.does.not.exist")
  })
})
