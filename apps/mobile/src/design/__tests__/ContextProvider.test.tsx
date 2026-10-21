/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderWithProviders } from "../../test/render"
import { ContextProvider, useContext_ } from "../ContextProvider"

const mocks = vi.hoisted(() => ({
  listOrganizations: vi.fn(),
  setContextId: vi.fn(),
}))

vi.mock("../../lib/api", () => ({
  api: { listOrganizations: mocks.listOrganizations },
}))

vi.mock("@amanak/api-client", () => ({
  setContextId: mocks.setContextId,
}))

vi.mock("../../state/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, email: "a@b.com" }, loading: false }),
}))

function Probe() {
  const { contextId, contextName, organizations } = useContext_()
  return (
    <div>
      <span data-testid="id">{contextId ?? "personal"}</span>
      <span data-testid="name">{contextName}</span>
      <span data-testid="orgs">{organizations.length}</span>
    </div>
  )
}

function render() {
  return renderWithProviders(
    <ContextProvider>
      <Probe />
    </ContextProvider>,
  )
}

describe("mobile ContextProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.localStorage.setItem("amanak.locale", "en")
    mocks.listOrganizations.mockResolvedValue([])
  })

  it("loads the stored context from storage", async () => {
    window.localStorage.setItem("amanak.context", "org-1")
    mocks.listOrganizations.mockResolvedValue([{ id: "org-1", name: "Acme", slug: "acme" }])

    const rendered = render()

    await vi.waitFor(() => {
      expect(rendered.container.querySelector('[data-testid="name"]')?.textContent).toBe("Acme")
    })
    expect(rendered.container.querySelector('[data-testid="id"]')?.textContent).toBe("org-1")
    rendered.unmount()
  })

  it("falls back to personal when the stored org is unknown", async () => {
    window.localStorage.setItem("amanak.context", "ghost")
    mocks.listOrganizations.mockResolvedValue([{ id: "org-1", name: "Acme", slug: "acme" }])

    const rendered = render()

    await vi.waitFor(() => {
      expect(rendered.container.querySelector('[data-testid="id"]')?.textContent).toBe("personal")
    })
    rendered.unmount()
  })
})
