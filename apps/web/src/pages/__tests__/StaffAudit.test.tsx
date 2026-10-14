import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ThemeProvider } from "../../design/ThemeProvider"
import { ToastProvider } from "../../design/components"
import { StaffAudit } from "../StaffAudit"

const auth = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }))
const apiMock = vi.hoisted(() => ({ listAuditLog: vi.fn() }))

vi.mock("../../state/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, loading: false }),
}))

vi.mock("../../lib/api", () => ({ api: apiMock }))

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}))

const ENTRY = {
  id: 1,
  actor: 5,
  actor_email: "sec@amanak.dev",
  action: "user.block",
  target_user: 10,
  target_type: "user",
  target_id: "10",
  before: { is_blocked: false, reason: "" },
  after: { is_blocked: true, reason: "abuse" },
  reason: "abuse",
  ip: "127.0.0.1",
  user_agent: "vitest",
  created_at: "2026-03-01T10:00:00Z",
}

function renderPage() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <StaffAudit />
      </ToastProvider>
    </ThemeProvider>,
  )
}

describe("StaffAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.setItem("amanak.locale", "en")
    auth.user = { id: 5, email: "sec@amanak.dev", is_staff: true, roles: ["security_admin"] }
    apiMock.listAuditLog.mockResolvedValue({ count: 1, page: 1, pages: 1, results: [ENTRY] })
  })

  it("renders audit rows", async () => {
    renderPage()
    expect(await screen.findByRole("cell", { name: "user.block" })).toBeInTheDocument()
    expect(screen.getByText("abuse")).toBeInTheDocument()
  })

  it("shows before/after JSON when a row is opened", async () => {
    renderPage()
    fireEvent.click(await screen.findByRole("cell", { name: "user.block" }))
    expect(await screen.findByText("Before")).toBeInTheDocument()
    expect(screen.getByText("After")).toBeInTheDocument()
    expect(screen.getAllByText(/is_blocked/).length).toBeGreaterThan(0)
  })
})
