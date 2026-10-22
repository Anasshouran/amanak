import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { PendingInvitations } from "../PendingInvitations"

vi.mock("../../../design/i18n", () => ({
  useT: () => (key: string) => {
    const map: Record<string, string> = {
      "org.members.pending": "Pending",
      "org.invitations.revoke": "Revoke",
      "org.invitations.revoke_confirm": "Revoke invitation",
      "org.invite.role.employee": "Employee",
      "org.invite.role.analyst": "Analyst",
      "org.invite.role.auditor": "Auditor",
      "org.invite.role.admin": "Admin",
      "common.cancel": "Cancel",
      "common.error": "Error",
    }
    return map[key] || key
  },
}))

vi.mock("../../../lib/api", () => ({
  api: { get: vi.fn(), delete: vi.fn() },
}))

describe("PendingInvitations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders pending invitations", async () => {
    const { api } = await import("../../../lib/api")
    ;(api.get as any).mockResolvedValue([
      {
        id: 1,
        email: "pending@example.com",
        role: "employee",
        status: "pending",
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
    ])
    render(<PendingInvitations orgId="o1" canManage={true} />)
    await waitFor(() => expect(screen.getByText("pending@example.com")).toBeTruthy())
    expect(screen.getByText("Employee")).toBeTruthy()
  })

  it("revoke removes invitation after confirmation", async () => {
    const { api } = await import("../../../lib/api")
    ;(api.get as any).mockResolvedValue([
      {
        id: 7,
        email: "revoke@example.com",
        role: "admin",
        status: "pending",
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
    ])
    ;(api.delete as any).mockResolvedValue({})
    render(<PendingInvitations orgId="o1" canManage={true} />)
    await waitFor(() => expect(screen.getByText("revoke@example.com")).toBeTruthy())
    fireEvent.click(screen.getByRole("button", { name: /revoke/i }))
    fireEvent.click(screen.getByRole("button", { name: /revoke invitation/i }))
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/organizations/o1/invitations/7/"))
  })
})
