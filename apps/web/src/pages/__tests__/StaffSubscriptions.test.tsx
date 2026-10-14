import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ThemeProvider } from "../../design/ThemeProvider"
import { ToastProvider } from "../../design/components"
import { StaffSubscriptions } from "../StaffSubscriptions"

const apiMock = vi.hoisted(() => ({
  listStaffSubscriptions: vi.fn(),
  changeStaffSubscription: vi.fn(),
}))

vi.mock("../../lib/api", () => ({ api: apiMock }))

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children?: unknown }) => <span>{children as never}</span>,
}))

function renderPage() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <StaffSubscriptions />
      </ToastProvider>
    </ThemeProvider>,
  )
}

describe("StaffSubscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem("amanak.locale", "en")
    apiMock.listStaffSubscriptions.mockResolvedValue({
      count: 1,
      page: 1,
      pages: 1,
      results: [
        {
          user_id: 10,
          email: "alpha@example.com",
          username: "alpha",
          plan: "pro",
          status: "active",
          period: "monthly",
          current_period_end: "2026-03-01T00:00:00Z",
        },
      ],
    })
    apiMock.changeStaffSubscription.mockResolvedValue({})
  })

  it("renders subscriptions returned by the API", async () => {
    renderPage()
    expect(await screen.findByText("alpha@example.com")).toBeInTheDocument()
    expect(screen.getAllByText("pro").length).toBeGreaterThan(0)
  })

  it("opens the change-plan modal", async () => {
    renderPage()
    await screen.findByText("alpha@example.com")
    fireEvent.click(screen.getByText("Change plan"))
    expect(await screen.findByText("Apply change")).toBeInTheDocument()
  })

  it("sends the search query to the API", async () => {
    renderPage()
    await screen.findByText("alpha@example.com")
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "alpha" } })
    await waitFor(
      () =>
        expect(apiMock.listStaffSubscriptions).toHaveBeenLastCalledWith(
          expect.objectContaining({ q: "alpha" }),
        ),
      { timeout: 2000 },
    )
  })
})
