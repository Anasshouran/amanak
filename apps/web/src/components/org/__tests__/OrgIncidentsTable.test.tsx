import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { OrgIncidentsTable } from "../OrgIncidentsTable"

vi.mock("../../../design/i18n", () => ({
  useT: () => (key: string) => key,
}))

describe("OrgIncidentsTable", () => {
  it("renders rows with the incident title and status", () => {
    const incidents = [
      {
        id: "1",
        title: "Bad login",
        severity: "high" as const,
        status: "open",
        created_at: new Date().toISOString(),
      },
    ]
    render(<OrgIncidentsTable incidents={incidents} />)
    expect(screen.getByText("Bad login")).toBeTruthy()
    expect(screen.getByText(/open/)).toBeTruthy()
  })

  it("colours the severity dot by severity", () => {
    const incidents = [
      {
        id: "1",
        title: "Ransomware",
        severity: "critical" as const,
        status: "open",
        created_at: new Date().toISOString(),
      },
    ]
    render(<OrgIncidentsTable incidents={incidents} />)
    const dot = document.querySelector(".amk-org-dot") as HTMLElement
    expect(dot.style.backgroundColor).toBe("rgb(239, 68, 68)")
  })
})
