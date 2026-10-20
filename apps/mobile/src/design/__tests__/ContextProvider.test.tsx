/** @vitest-environment jsdom */
import { act } from "react-dom/test-utils"
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

/** Flush all pending React updates inside act, then wait a tick for async effects. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

function id(rendered: ReturnType<typeof render>): string | null {
  return rendered.container.querySelector('[data-testid="id"]')?.textContent ?? null
}

function name(rendered: ReturnType<typeof render>): string | null {
  return rendered.container.querySelector('[data-testid="name"]')?.textContent ?? null
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
    await flush()
    await flush()

    expect(id(rendered)).toBe("org-1")
    expect(name(rendered)).toBe("Acme")
    expect(mocks.setContextId).toHaveBeenCalledWith("org-1")
    rendered.unmount()
  })

  it("falls back to personal when the stored org is unknown", async () => {
    window.localStorage.setItem("amanak.context", "ghost")
    mocks.listOrganizations.mockResolvedValue([{ id: "org-1", name: "Acme", slug: "acme" }])

    const rendered = render()
    await flush()
    await flush()

    expect(id(rendered)).toBe("personal")
    expect(window.localStorage.getItem("amanak.context")).toBeNull()
    rendered.unmount()
  })

  it("stored org survives reload with async org fetch", async () => {
    mocks.listOrganizations.mockImplementation(
      () => new Promise((resolve) =>
        setTimeout(() => resolve([{ id: "org-1", name: "Acme", slug: "acme" }]), 100),
      ),
    )
    window.localStorage.setItem("amanak.context", "org-1")

    const rendered = render()
    await flush()

    // While fetching, valid stored id must be preserved (not null).
    expect(id(rendered)).toBe("org-1")

    await flush()
    await flush()

    expect(name(rendered)).toBe("Acme")
    expect(id(rendered)).toBe("org-1")
    expect(mocks.setContextId).toHaveBeenCalledWith("org-1")
    expect(window.localStorage.getItem("amanak.context")).toBe("org-1")
    rendered.unmount()
  })

  it("ghost org id falls back to Personal and cleans storage", async () => {
    mocks.listOrganizations.mockResolvedValue([])
    window.localStorage.setItem("amanak.context", "ghost")

    const rendered = render()
    await flush()
    await flush()

    expect(id(rendered)).toBe("personal")
    expect(window.localStorage.getItem("amanak.context")).toBeNull()
    expect(mocks.setContextId).toHaveBeenCalledWith(null)
    rendered.unmount()
  })
})
