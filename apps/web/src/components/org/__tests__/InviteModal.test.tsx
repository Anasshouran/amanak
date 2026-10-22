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
  api: { post: vi.fn() },
}))

describe("InviteModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("validates email - shows error for invalid email", async () => {
    render(<InviteModal open onClose={() => {}} orgId="o1" orgName="Acme" isOwner={true} />)
    const input = screen.getByLabelText(/email/i)
    fireEvent.change(input, { target: { value: "not-an-email" } })
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }))
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.getByText(/valid email address/i)).toBeTruthy()
  })

  it("submits valid invite for owner", async () => {
    const { api } = await import("../../../lib/api")
    ;(api.post as any).mockResolvedValue({})
    const onClose = vi.fn()
    render(<InviteModal open onClose={onClose} orgId="o1" orgName="Acme" isOwner={true} />)
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
    render(<InviteModal open onClose={() => {}} orgId="o1" orgName="Acme" isOwner={true} />)
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
})
