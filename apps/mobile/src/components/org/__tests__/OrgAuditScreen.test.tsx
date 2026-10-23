/** @vitest-environment jsdom */
import { act } from "react-dom/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  role: "owner" as string,
  rows: [
    {
      id: 1,
      action: "member.role_changed",
      actor: { id: 5, email: "a@x.com" },
      target_type: "member",
      target_id: "7",
      target_email: "b@x.com",
      metadata: { before: { role: "employee" }, after: { role: "admin" } },
      ip: "127.0.0.1",
      created_at: "2026-01-01T00:00:00Z",
    },
  ],
}))

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() },
  setItem: vi.fn(),
  getItem: vi.fn(),
  removeItem: vi.fn(),
}))

vi.mock("../../../design/ContextProvider", () => ({
  useContext_: () => ({
    contextId: "org-1",
    contextName: "Acme",
    organizations: [{ id: "org-1", name: "Acme", slug: "acme", role: state.role }],
    loading: false,
    switchContext: vi.fn(),
  }),
}))

vi.mock("../../../lib/api", () => ({
  api: {
    listOrgAudit: vi.fn(() => Promise.resolve({ count: state.rows.length, results: state.rows })),
  },
}))

import { renderWithProviders } from "../../../test/render"
import { OrgAuditScreen } from "../OrgAuditScreen"

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe("OrgAuditScreen", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
    state.role = "owner"
  })

  it("renders", async () => {
    const rendered = renderWithProviders(<OrgAuditScreen />)
    await flush()
    const text = rendered.text()
    expect(text).toContain("Audit Log")
    rendered.unmount()
  })

  it("empty state", async () => {
    state.rows = []
    const rendered = renderWithProviders(<OrgAuditScreen />)
    await flush()
    const text = rendered.text()
    expect(text).toContain("No audit entries")
    state.rows = [
      {
        id: 1,
        action: "member.role_changed",
        actor: { id: 5, email: "a@x.com" },
        target_type: "member",
        target_id: "7",
        target_email: "b@x.com",
        metadata: {},
        ip: "127.0.0.1",
        created_at: "2026-01-01T00:00:00Z",
      },
    ]
    rendered.unmount()
  })
})
