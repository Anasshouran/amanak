import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { InviteModal } from "../InviteModal"

vi.mock("../../../design/i18n", () => ({
  useT: () => (key: string) => {
    const map: Record<string, string> = {
      "org.invite.title": "Invite",
      "org.invite.email": "Email",
      "org.invite.role": "Role",
      "org.invite.submit": "Send invite",
      "org.invite.success": "Invite sent",
      "org.invite.invalid_email": "Please enter a valid email address",
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
  api: { post: vi.fn(), getOrgUsage: vi.fn() },
}))

describe("InviteModal", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const apiMod = await import("../../../lib/api")
    const api = (apiMod as any).api || apiMod
    api.getOrgUsage = api.getOrgUsage || vi.fn()
    ;(api.getOrgUsage as any).mockResolvedValue({ plan: "business", members: { used: 1, limit: 10 }, devices: { used: 0, limit: -1 }, incidents: { used: 0, limit: -1 }, ai_requests: { used: 0, limit: 2000 } })
  })

  it("validates email - shows error for invalid email", async () => {
    render(<InviteModal open onClose={() => {}} orgId="o1" orgName="Acme" isOwner={true} />)
    await waitFor(() => {})
    const input = screen.getByLabelText(/email/i)
    fireEvent.change(input, { target: { value: "not-an-email" } })
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }))
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.getByText(/valid email address/i)).toBeTruthy()
  })

  it("submits valid invite for owner", async () => {
    const { api } = await import("../../../lib/api")
    ;(api.post as any).mockResolvedValue({})
    ;(api.getOrgUsage as any).mockResolvedValue({ plan: "business", members: { used: 1, limit: 10 }, devices: { used: 0, limit: -1 }, incidents: { used: 0, limit: -1 }, ai_requests: { used: 0, limit: 2000 } })
    const onClose = vi.fn()
    render(<InviteModal open onClose={onClose} orgId="o1" orgName="Acme" isOwner={true} />)
    await waitFor(() => {})
    const input = screen.getByLabelText(/email/i)
    fireEvent.change(input, { target: { value: "test@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      "/organizations/o1/members/invite/",
      expect.objectContaining({ email: "test@example.com" })
    ))
  })

  it("owner can invite admin role", async () => {
    const { api } = await import("../../../lib/api")
    ;(api.post as any).mockResolvedValue({})
    ;(api.getOrgUsage as any).mockResolvedValue({ plan: "business", members: { used: 1, limit: 10 }, devices: { used: 0, limit: -1 }, incidents: { used: 0, limit: -1 }, ai_requests: { used: 0, limit: 2000 } })
    render(<InviteModal open onClose={() => {}} orgId="o1" orgName="Acme" isOwner={true} />)
    await waitFor(() => {})
    const input = screen.getByLabelText(/email/i)
    fireEvent.change(input, { target: { value: "admin@example.com" } })
    const roleSelect = screen.getByLabelText(/role/i)
    fireEvent.change(roleSelect, { target: { value: "admin" } })
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(
      "/organizations/o1/members/invite/",
      expect.objectContaining({ email: "admin@example.com", role: "admin" })
    ))
  })

  it("disables send when member limit reached", async () => {
    const { api } = await import("../../../lib/api")
    ;(api.getOrgUsage as any).mockResolvedValue({
      plan: "business",
      members: { used: 10, limit: 10 },
      devices: { used: 0, limit: -1 },
      incidents: { used: 0, limit: -1 },
      ai_requests: { used: 0, limit: 2000 },
    })

    render(<InviteModal open onClose={() => {}} orgId="org-1" orgName="Org" isOwner={true} />)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /send/i })).toBeDisabled()
    })
    expect(screen.getAllByText(/limit/i).length).toBeGreaterThan(0)
  })
})
