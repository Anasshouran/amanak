import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { OrgMembersTable } from "../OrgMembersTable"

vi.mock("../../../design/i18n", () => ({
  useT: () => (key: string) => key,
}))
vi.mock("../../../lib/api", () => ({ api: { patch: vi.fn(), delete: vi.fn() } }))

const owner = {
  user_id: 1,
  email: "owner@x.com",
  role: "owner" as const,
  joined_at: new Date().toISOString(),
}
const employee = {
  user_id: 2,
  email: "u@x.com",
  role: "employee" as const,
  joined_at: new Date().toISOString(),
}

describe("OrgMembersTable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

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

  it("shows the role dropdown only to the owner", () => {
    render(<OrgMembersTable members={[employee]} canManage={true} isOwner={false} orgId="o1" />)
    expect(screen.queryByRole("combobox")).toBeNull()

    render(<OrgMembersTable members={[employee]} canManage={true} isOwner={true} orgId="o1" />)
    expect(screen.getAllByRole("combobox").length).toBe(1)
  })

  it("does not let the last owner be demoted or removed", () => {
    render(<OrgMembersTable members={[owner]} canManage={true} isOwner={true} orgId="o1" />)
    const select = screen.getByRole("combobox") as HTMLSelectElement
    expect(select.disabled).toBe(true)
    expect(screen.queryByText("org.members.remove")).toBeNull()
  })

  it("asks for confirmation before removing a member", async () => {
    const { api } = await import("../../../lib/api")
    render(<OrgMembersTable members={[owner, employee]} canManage={true} isOwner={true} orgId="o1" />)

    fireEvent.click(screen.getByText("org.members.remove"))
    expect(screen.getByText("org.members.remove_confirm_title")).toBeTruthy()
    expect(api.delete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText("org.members.remove_confirm_title"))
    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith("/organizations/o1/members/2/"),
    )
  })

  it("changes a member role through the API", async () => {
    const { api } = await import("../../../lib/api")
    ;(api.patch as any).mockResolvedValue({})
    render(<OrgMembersTable members={[owner, employee]} canManage={true} isOwner={true} orgId="o1" />)

    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: "analyst" } })
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith("/organizations/o1/members/2/", { role: "analyst" }),
    )
  })
})
