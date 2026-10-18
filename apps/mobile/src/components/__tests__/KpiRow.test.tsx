/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest"
import { renderWithProviders } from "../../test/render"
import { KpiRow } from "../KpiRow"

describe("KpiRow", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("renders every label and value", () => {
    const rendered = renderWithProviders(
      <KpiRow
        items={[
          { key: "devices", label: "Devices", value: "3" },
          { key: "accounts", label: "Accounts", value: "12" },
          { key: "incidents", label: "Open incidents", value: "1" },
          { key: "breach", label: "Breach monitoring", value: "Enabled", tint: "success" },
        ]}
      />,
    )
    const text = rendered.text()
    expect(text).toContain("Devices")
    expect(text).toContain("12")
    expect(text).toContain("Breach monitoring")
    expect(text).toContain("Enabled")
    rendered.unmount()
  })

  it("shows a placeholder for values that have not loaded yet", () => {
    const rendered = renderWithProviders(
      <KpiRow items={[{ key: "devices", label: "Devices", value: "—" }]} />,
    )
    expect(rendered.text()).toContain("—")
    rendered.unmount()
  })
})
