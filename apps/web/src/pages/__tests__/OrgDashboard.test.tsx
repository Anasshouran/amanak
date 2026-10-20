import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { OrgDashboard } from "../OrgDashboard"

const state = vi.hoisted(() => ({
  contextId: null as string | null,
  getOverview: vi.fn(),
}))

vi.mock("react-router-dom", () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
}))

vi.mock("../../lib/api", () => ({
  api: {
    getOrganizationOverview: state.getOverview,
  },
}))

vi.mock("../../state/ContextProvider", () => ({
  useContext_: () => ({ contextId: state.contextId }),
}))

vi.mock("../../design/i18n", () => ({
  useT: () => (key: string) => key,
}))

vi.mock("../../design/components/Skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}))

vi.mock("../../design/components/ErrorState", () => ({
  ErrorState: ({ message }: { message?: ReactNode }) => <div>{message}</div>,
}))

vi.mock("../../design/components/KpiCard", () => ({
  KpiCard: ({ label, value }: { label: string; value: number }) => (
    <div>
      {label}:{value}
    </div>
  ),
}))

describe("OrgDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.contextId = null
  })

  it("redirects to /dashboard in personal context", () => {
    render(<OrgDashboard />)
    expect(screen.getByTestId("navigate")).toHaveTextContent("/dashboard")
  })

  it("renders aggregates when an org context is active", async () => {
    state.contextId = "org-1"
    state.getOverview.mockResolvedValue({
      organization: { id: "org-1", name: "Acme", slug: "acme" },
      member_count: 3,
      device_count: 12,
      open_incident_count: 3,
      security_score: 72,
      recent_activity: 8,
    })

    render(<OrgDashboard />)

    await waitFor(() => expect(screen.getByText("Acme")).toBeTruthy())
    expect(screen.getByText("org.dashboard.members:3")).toBeTruthy()
    expect(screen.getByText("org.dashboard.devices:12")).toBeTruthy()
    expect(screen.getByText("org.dashboard.score:72")).toBeTruthy()
  })
})
