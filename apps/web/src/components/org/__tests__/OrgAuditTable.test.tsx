import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { OrgAuditTable } from "../OrgAuditTable"

vi.mock("../../../design/i18n", () => ({
  useT: () => (key: string) => key,
}))

const row = {
  id: 1,
  action: "member.role_changed",
  actor: { id: 5, email: "a@x.com" },
  target_type: "member",
  target_id: "7",
  target_email: "b@x.com",
  metadata: { before: { role: "employee" }, after: { role: "admin" } },
  ip: "127.0.0.1",
  created_at: new Date().toISOString(),
}

describe("OrgAuditTable", () => {
  it("renders rows", () => {
    render(<OrgAuditTable rows={[row as any]} />)
    expect(screen.getByText(/a@x.com/)).toBeTruthy()
  })

  it("empty state", () => {
    render(<OrgAuditTable rows={[]} />)
    expect(screen.getByText("org.audit.empty")).toBeTruthy()
  })

  it("row expand shows metadata", () => {
    render(<OrgAuditTable rows={[row as any]} />)
    fireEvent.click(screen.getByText("org.audit.details.show"))
    expect(screen.getByText(/employee/)).toBeTruthy()
  })
})
