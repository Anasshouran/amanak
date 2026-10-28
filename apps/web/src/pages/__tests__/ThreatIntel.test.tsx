import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ThemeProvider } from "../../design/ThemeProvider"
import { ToastProvider } from "../../design/components"
import { ThreatIntel } from "../ThreatIntel"

const auth = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }))
const apiMock = vi.hoisted(() => ({
  getThreatIntelStatus: vi.fn(),
  refreshThreatIntel: vi.fn(),
  checkThreatIntelDomain: vi.fn(),
}))

vi.mock("../../state/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, loading: false }),
}))

vi.mock("../../lib/api", () => ({ api: apiMock }))

function renderPage() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <ThreatIntel />
      </ToastProvider>
    </ThemeProvider>,
  )
}

describe("ThreatIntel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem("amanak.locale", "en")
    auth.user = { id: 1, email: "sec@amanak.dev", is_staff: true, roles: ["security_admin"] }
    apiMock.getThreatIntelStatus.mockResolvedValue({
      feeds: [
        { source: "openphish", count: 293, last_sync: 1793188789, status: "ok" },
        { source: "urlhaus", count: 0, last_sync: null, status: "never" },
      ],
    })
    apiMock.refreshThreatIntel.mockResolvedValue({ triggered: true })
    apiMock.checkThreatIntelDomain.mockResolvedValue({ matched: false })
  })

  it("test_renders_feeds", async () => {
    renderPage()
    expect(await screen.findByText("OpenPhish")).toBeInTheDocument()
    expect(screen.getByText("URLhaus")).toBeInTheDocument()
  })

  it("test_refresh_button_calls_api", async () => {
    renderPage()
    await screen.findByText("OpenPhish")
    const btn = screen.getByRole("button", { name: /Refresh feeds/i })
    fireEvent.click(btn)
    expect(apiMock.refreshThreatIntel).toHaveBeenCalled()
  })
})
