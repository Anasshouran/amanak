import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ThemeProvider } from "../../design/ThemeProvider"
import { ToastProvider } from "../../design/components"
import { StaffUsers } from "../StaffUsers"

const auth = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }))
const apiMock = vi.hoisted(() => ({
  listStaffUsers: vi.fn(),
  getStaffUser: vi.fn(),
}))

vi.mock("../../state/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, loading: false }),
}))

vi.mock("../../lib/api", () => ({ api: apiMock }))

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children?: unknown }) => <span>{children as never}</span>,
}))

function snapshot(id: number, email: string, plan: string, blocked: boolean) {
  return {
    user: {
      id,
      email,
      username: email.split("@")[0],
      is_verified: true,
      is_active: true,
      is_staff: false,
      date_joined: "2026-01-01T00:00:00Z",
    },
    subscription: { plan, status: "active", current_period_end: null },
    usage_this_month: { scans: { used: 0, limit: 10 }, ai_requests: { used: 0, limit: 5 } },
    moderation: { is_blocked: blocked, reason: "" },
    counts: { scans_total: 0, incidents_total: 0, vault_entries: 0, "2fa_entries": 0 },
  }
}

function renderPage() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <StaffUsers />
      </ToastProvider>
    </ThemeProvider>,
  )
}

describe("StaffUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem("amanak.locale", "en")
    auth.user = { id: 1, email: "sec@amanak.dev", is_staff: true, roles: ["security_admin"] }
    apiMock.listStaffUsers.mockResolvedValue({
      count: 2,
      page: 1,
      pages: 2,
      results: [
        {
          id: 10,
          email: "alpha@example.com",
          username: "alpha",
          is_verified: true,
          is_active: true,
          is_staff: false,
          date_joined: "2026-01-01T00:00:00Z",
        },
        {
          id: 11,
          email: "beta@example.com",
          username: "beta",
          is_verified: false,
          is_active: true,
          is_staff: false,
          date_joined: "2026-02-01T00:00:00Z",
        },
      ],
    })
    apiMock.getStaffUser.mockImplementation((id: number) =>
      Promise.resolve(
        id === 10
          ? snapshot(10, "alpha@example.com", "pro", false)
          : snapshot(11, "beta@example.com", "free", true),
      ),
    )
  })

  it("renders users returned by the API", async () => {
    renderPage()
    expect(await screen.findByText("alpha@example.com")).toBeInTheDocument()
    expect(screen.getByText("beta@example.com")).toBeInTheDocument()
  })

  it("sends the search query to the API", async () => {
    renderPage()
    await screen.findByText("alpha@example.com")
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "alpha" } })
    await waitFor(
      () =>
        expect(apiMock.listStaffUsers).toHaveBeenLastCalledWith(
          expect.objectContaining({ q: "alpha" }),
        ),
      { timeout: 2000 },
    )
  })

  it("paginates to the next page", async () => {
    renderPage()
    await screen.findByText("alpha@example.com")
    fireEvent.click(screen.getByText("›"))
    await waitFor(() =>
      expect(apiMock.listStaffUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    )
  })
})
