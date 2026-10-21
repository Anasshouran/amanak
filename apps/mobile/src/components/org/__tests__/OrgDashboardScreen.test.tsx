/** @vitest-environment jsdom */
import { act } from "react-dom/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  role: "owner" as string,
  overview: {
    organization: { id: "org-1", name: "Acme", slug: "acme" },
    member_count: 3,
    device_count: 12,
    open_incident_count: 2,
    security_score: 72,
    recent_activity: 1,
    recent_devices: [
      { id: "d1", name: "MacBook", os: "macOS", type: "laptop", last_seen: "2026-01-01T00:00:00Z" },
    ],
    recent_incidents: [],
  },
  members: [] as unknown[],
  activity: [] as unknown[],
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
    getOrganizationOverview: vi.fn(() => Promise.resolve(state.overview)),
    listOrganizationMembers: vi.fn(() => Promise.resolve(state.members)),
    listOrganizationActivity: vi.fn(() => Promise.resolve(state.activity)),
  },
}))

import { renderWithProviders } from "../../../test/render"
import { OrgDashboardScreen } from "../org"

/** Let pending promises settle inside `act()`. */
async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe("OrgDashboardScreen", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
    state.role = "owner"
  })

  it("renders the org KPIs from the overview", async () => {
    const rendered = renderWithProviders(<OrgDashboardScreen />)
    await flush()
    const text = rendered.text()
    expect(text).toContain("Acme")
    expect(text).toContain("Members")
    expect(text).toContain("Devices")
    expect(text).toContain("Recent Devices")
    expect(text).toContain("MacBook")
    rendered.unmount()
  })

  it("hides the activity feed for an employee", async () => {
    state.role = "employee"
    const rendered = renderWithProviders(<OrgDashboardScreen />)
    await flush()
    const text = rendered.text()
    expect(text).toContain("Members")
    expect(text).not.toContain("Recent Activity")
    rendered.unmount()
  })
})
