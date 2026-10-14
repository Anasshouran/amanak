import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { ThemeProvider } from "../../design/ThemeProvider"
import { ToastProvider } from "../../design/components"
import { StaffUserDetail } from "../StaffUserDetail"

const auth = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }))
const apiMock = vi.hoisted(() => ({
  getStaffUser: vi.fn(),
  listTickets: vi.fn(),
  blockStaffUser: vi.fn(),
  unblockStaffUser: vi.fn(),
  createTicket: vi.fn(),
}))

vi.mock("../../state/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, loading: false }),
}))

vi.mock("../../lib/api", () => ({ api: apiMock }))

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: "10" }),
  Link: ({ children }: { children?: unknown }) => <>{children}</>,
}))

const SNAPSHOT = {
  user: {
    id: 10,
    email: "alpha@example.com",
    username: "alpha",
    is_verified: true,
    is_active: true,
    is_staff: false,
    date_joined: "2026-01-01T00:00:00Z",
  },
  subscription: { plan: "pro", status: "active", current_period_end: null },
  usage_this_month: { scans: { used: 3, limit: 10 }, ai_requests: { used: 1, limit: 5 } },
  moderation: { is_blocked: false, reason: "" },
  counts: { scans_total: 4, incidents_total: 0, vault_entries: 1, "2fa_entries": 0 },
}

function renderPage() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <StaffUserDetail />
      </ToastProvider>
    </ThemeProvider>,
  )
}

describe("StaffUserDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem("amanak.locale", "en")
    apiMock.getStaffUser.mockResolvedValue(SNAPSHOT)
    apiMock.listTickets.mockResolvedValue({ count: 0, page: 1, pages: 1, results: [] })
  })

  it("shows the block button to a security admin", async () => {
    auth.user = { id: 1, email: "sec@amanak.dev", is_staff: true, roles: ["security_admin"] }
    renderPage()
    expect(await screen.findByRole("heading", { name: "alpha@example.com" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Block user" })).toBeInTheDocument()
  })

  it("hides the block button from a support agent", async () => {
    auth.user = { id: 2, email: "sup@amanak.dev", is_staff: true, roles: ["support"] }
    renderPage()
    await screen.findByRole("heading", { name: "alpha@example.com" })
    expect(screen.queryByRole("button", { name: "Block user" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Unblock user" })).not.toBeInTheDocument()
  })
})
