import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ThemeProvider } from "../../design/ThemeProvider"
import { ToastProvider } from "../../design/components"
import { StaffMetrics } from "../StaffMetrics"

const auth = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }))
const apiMock = vi.hoisted(() => ({
  listStaffMetrics: vi.fn(),
  listAuditLog: vi.fn(),
}))

vi.mock("../../state/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, loading: false }),
}))

vi.mock("../../lib/api", () => ({ api: apiMock }))

function renderPage() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <StaffMetrics />
      </ToastProvider>
    </ThemeProvider>,
  )
}

describe("StaffMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem("amanak.locale", "en")
    auth.user = { id: 1, email: "sec@amanak.dev", is_staff: true, roles: ["security_admin"] }
    apiMock.listStaffMetrics.mockResolvedValue({
      signups_per_day: [{ date: "2026-10-01", count: 2 }],
      scans_per_day: [{ date: "2026-10-01", count: 5 }],
      subscriptions_by_plan: { free: 10, pro: 3 },
      tickets_opened_per_day: [{ date: "2026-10-01", count: 1 }],
      tickets_closed_per_day: [],
    })
    apiMock.listAuditLog.mockResolvedValue({ count: 0, page: 1, pages: 1, results: [] })
  })

  it("consumes the metrics endpoint and renders plan totals", async () => {
    renderPage()
    expect(await screen.findByText("pro")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(apiMock.listStaffMetrics).toHaveBeenCalledWith({ range: "30d" })
  })

  it("requests a new range when a range button is clicked", async () => {
    renderPage()
    await screen.findByText("pro")
    fireEvent.click(screen.getByRole("button", { name: "7 days" }))
    expect(apiMock.listStaffMetrics).toHaveBeenLastCalledWith({ range: "7d" })
  })
})
