import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { OrgMembersTable } from "../OrgMembersTable"

vi.mock("../../../design/i18n", () => ({
  useT: () => (key: string) => key,
}))

describe("OrgMembersTable", () => {
  it("renders each member with their role", () => {
    const members = [
      {
        user_id: 1,
        email: "owner@x.com",
        role: "owner" as const,
        joined_at: new Date().toISOString(),
      },
      {
        user_id: 2,
        email: "analyst@x.com",
        role: "analyst" as const,
        joined_at: new Date().toISOString(),
      },
    ]
    render(<OrgMembersTable members={members} />)
    expect(screen.getByText("owner@x.com")).toBeTruthy()
    expect(screen.getByText("org.members.role.owner")).toBeTruthy()
    expect(screen.getByText("org.members.role.analyst")).toBeTruthy()
  })

  it("renders nothing for an employee", () => {
    render(<OrgMembersTable members={[]} canView={false} />)
    expect(screen.queryByText("org.dashboard.members")).toBeNull()
  })
})
