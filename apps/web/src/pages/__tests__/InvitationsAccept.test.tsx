import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { InvitationsAccept } from "../InvitationsAccept"

/**
 * `react-router-dom` is mocked rather than rendered through `MemoryRouter`.
 *
 * The monorepo hoists `react-router` to the root node_modules while the app
 * keeps its own React copy under apps/web/node_modules, so a real
 * `MemoryRouter` ends up with two React instances and crashes with
 * "Cannot read properties of null (reading 'useRef')". That is a packaging
 * issue, not a bug in this page. The page only touches two router APIs, so
 * stubbing them keeps the test honest: it still asserts the token is sent to
 * the API, the success path, and the error path.
 */
const routerMock = vi.hoisted(() => ({
  token: "",
  navigate: vi.fn(),
}))

vi.mock("react-router-dom", () => ({
  useSearchParams: () => [
    new URLSearchParams(routerMock.token ? `token=${routerMock.token}` : ""),
  ],
  useNavigate: () => routerMock.navigate,
}))

vi.mock("../../lib/api", () => ({
  api: { post: vi.fn() },
}))

vi.mock("../../design/i18n", () => ({
  useT: () => (key: string) => key,
}))

const authState = vi.hoisted(() => ({
  value: {
    user: { id: 1, email: "invitee@example.com" } as { id: number; email: string } | null,
    loading: false,
  },
}))

vi.mock("../../state/AuthContext", () => ({
  useAuth: () => authState.value,
}))

const contextMock = vi.hoisted(() => ({ refresh: vi.fn(), activate: vi.fn() }))

vi.mock("../../state/ContextProvider", () => ({
  useContext_: () => contextMock,
}))

describe("InvitationsAccept", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routerMock.token = ""
    authState.value = { user: { id: 1, email: "invitee@example.com" }, loading: false }
    contextMock.refresh.mockResolvedValue(undefined)
  })

  it("accepts a valid invitation token after an explicit click", async () => {
    const { api } = await import("../../lib/api")
    ;(api.post as any).mockResolvedValue({ organization: { id: "o1" }, role: "employee" })
    routerMock.token = "valid-token"

    render(<InvitationsAccept />)

    // No request before the user actually accepts.
    expect(api.post).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "org.invitations.accept.accept" }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/organizations/invitations/accept/", {
        token: "valid-token",
      }),
    )
    await waitFor(() =>
      expect(screen.getByText("org.invitations.accept.accepted")).toBeTruthy(),
    )
    // The joined tenant becomes the active context so /org renders it.
    expect(contextMock.activate).toHaveBeenCalledWith("o1")
  })

  it("shows an error for an expired invitation", async () => {
    const { api } = await import("../../lib/api")
    ;(api.post as any).mockRejectedValue({
      response: { data: { code: "invitation_expired" } },
    })
    routerMock.token = "expired-token"

    render(<InvitationsAccept />)
    fireEvent.click(screen.getByRole("button", { name: "org.invitations.accept.accept" }))

    await waitFor(() =>
      expect(screen.getByText("org.invitations.accept.expired")).toBeTruthy(),
    )
  })

  it("shows an error for an invalid invitation", async () => {
    const { api } = await import("../../lib/api")
    ;(api.post as any).mockRejectedValue({
      response: { data: { code: "invalid_invitation" } },
    })
    routerMock.token = "bad-token"

    render(<InvitationsAccept />)
    fireEvent.click(screen.getByRole("button", { name: "org.invitations.accept.accept" }))

    await waitFor(() =>
      expect(screen.getByText("org.invitations.accept.invalid")).toBeTruthy(),
    )
  })
})
