import { render, screen, fireEvent } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../design/ThemeProvider"
import SecurityActivity from "../SecurityActivity"

const apiMock = vi.hoisted(() => ({
  getSessions: vi.fn(),
  getActivity: vi.fn(),
  getAlerts: vi.fn(),
  revokeAllSessions: vi.fn(),
  markAlertRead: vi.fn(),
}))

vi.mock("../../lib/api", () => ({ api: apiMock }))

describe("SecurityActivity", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
    apiMock.getSessions.mockResolvedValue([])
    apiMock.getActivity.mockResolvedValue([])
    apiMock.getAlerts.mockResolvedValue([])
    apiMock.revokeAllSessions.mockResolvedValue({ revoked: 0 })
  })

  it("renders the three tabs", () => {
    render(
      <ThemeProvider>
        <SecurityActivity />
      </ThemeProvider>,
    )
    expect(screen.getByRole("tab", { name: /Sessions/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Activity/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Alerts/i })).toBeInTheDocument()
  })

  it("calls revokeAllSessions when revoke-all is clicked", async () => {
    apiMock.getSessions.mockResolvedValue([
      { jti: "abc", created_at: new Date().toISOString(), last_used: new Date().toISOString(), device: "Chrome", current: true },
    ])
    render(
      <ThemeProvider>
        <SecurityActivity />
      </ThemeProvider>,
    )
    const btn = await screen.findByRole("button", { name: /Revoke all other sessions/i })
    fireEvent.click(btn)
    // revokeAllSessions is invoked (may trigger navigation; ignore)
    await new Promise((r) => setTimeout(r, 50))
    expect(apiMock.revokeAllSessions).toHaveBeenCalled()
  })
})
