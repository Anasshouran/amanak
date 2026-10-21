import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { OrgDevicesTable } from "../OrgDevicesTable"

vi.mock("../../../design/i18n", () => ({
  useT: () => (key: string) => key,
}))

describe("OrgDevicesTable", () => {
  it("renders 5 rows", () => {
    const devices = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      name: `Device ${i}`,
      os: "macOS",
      type: "laptop",
      last_seen: new Date().toISOString(),
    }))
    render(<OrgDevicesTable devices={devices} />)
    expect(screen.getAllByText(/Device/)).toHaveLength(5)
  })

  it("renders empty state", () => {
    render(<OrgDevicesTable devices={[]} />)
    expect(screen.getByText("—")).toBeTruthy()
  })
})
