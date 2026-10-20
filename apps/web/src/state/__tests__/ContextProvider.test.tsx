import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import { ContextProvider, useContext_ } from "../ContextProvider"

const mocks = vi.hoisted(() => ({
  listOrganizations: vi.fn(),
  setContextId: vi.fn(),
  me: vi.fn(),
}))

vi.mock("../../lib/api", () => ({
  api: {
    listOrganizations: mocks.listOrganizations,
    me: mocks.me,
  },
  setContextId: mocks.setContextId,
}))

vi.mock("../AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, email: "a@b.com" }, loading: false }),
}))

function Probe() {
  const { contextId, contextName, organizations, switchContext } = useContext_()
  return (
    <>
      <span data-testid="id">{contextId ?? "personal"}</span>
      <span data-testid="name">{contextName}</span>
      <span data-testid="orgs">{organizations.length}</span>
      <button type="button" onClick={() => switchContext("org-9")}>
        switch
      </button>
    </>
  )
}

function renderWithProvider() {
  return render(
    <ContextProvider>
      <Probe />
    </ContextProvider>,
  )
}

describe("ContextProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    mocks.listOrganizations.mockResolvedValue([])
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it("loads the stored context from localStorage", async () => {
    window.localStorage.setItem("amanak.context", "org-1")
    mocks.listOrganizations.mockResolvedValue([{ id: "org-1", name: "Acme", slug: "acme" }])

    renderWithProvider()

    await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("Acme"))
    expect(screen.getByTestId("id")).toHaveTextContent("org-1")
    expect(mocks.setContextId).toHaveBeenCalledWith("org-1")
  })

  it("switchContext writes to localStorage and reloads", async () => {
    const reload = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    })

    renderWithProvider()
    await waitFor(() => expect(mocks.listOrganizations).toHaveBeenCalled())

    act(() => {
      screen.getByRole("button", { name: "switch" }).click()
    })

    expect(window.localStorage.getItem("amanak.context")).toBe("org-9")
    expect(mocks.setContextId).toHaveBeenCalledWith("org-9")
    expect(reload).toHaveBeenCalled()
  })

  it("falls back to personal when the stored org is not in the list", async () => {
    window.localStorage.setItem("amanak.context", "ghost")
    mocks.listOrganizations.mockResolvedValue([{ id: "org-1", name: "Acme", slug: "acme" }])

    renderWithProvider()

    await waitFor(() => expect(screen.getByTestId("id")).toHaveTextContent("personal"))
    expect(window.localStorage.getItem("amanak.context")).toBeNull()
  })
})
