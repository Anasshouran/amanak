import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { AuthProvider, useAuth } from "../AuthContext"

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  setTokens: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
}))

vi.mock("../../lib/api", () => ({
  api: {
    register: mocks.register,
    logout: mocks.logout,
    me: mocks.me,
    login: vi.fn(),
  },
  tokens: {
    setTokens: mocks.setTokens,
    getAccessToken: vi.fn(),
    getRefreshToken: vi.fn(),
    clear: vi.fn(),
  },
}))

function Probe() {
  const { register, user } = useAuth()
  return (
    <>
      <button type="button" onClick={() => void register("a@b.com", "user", "password123")}>
        reg
      </button>
      <span data-testid="user">{user ? user.email : "none"}</span>
    </>
  )
}

describe("AuthContext.register", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.me.mockRejectedValue(new Error("unauthenticated"))
  })

  it("stores the issued tokens instead of logging out", async () => {
    const tokens = { access: "access-token", refresh: "refresh-token" }
    mocks.register.mockResolvedValue({ user: { email: "a@b.com" }, tokens })
    mocks.setTokens.mockResolvedValue(undefined)

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    fireEvent.click(screen.getByRole("button", { name: "reg" }))

    await waitFor(() => expect(mocks.setTokens).toHaveBeenCalledWith(tokens))
    expect(mocks.logout).not.toHaveBeenCalled()
    expect(screen.getByTestId("user")).toHaveTextContent("a@b.com")
  })
})
