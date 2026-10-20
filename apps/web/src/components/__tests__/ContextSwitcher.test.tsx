import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ContextSwitcher } from "../ContextSwitcher"

const state = vi.hoisted(() => ({
  contextId: null as string | null,
  contextName: "Personal",
  organizations: [] as Array<{ id: string; name: string; slug: string }>,
  switchContext: vi.fn(),
}))

vi.mock("../../state/ContextProvider", () => ({
  useContext_: () => ({
    contextId: state.contextId,
    contextName: state.contextName,
    organizations: state.organizations,
    loading: false,
    switchContext: state.switchContext,
  }),
}))

vi.mock("../../design/i18n", () => ({
  useT: () => (key: string) => key,
}))

describe("ContextSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.contextId = null
    state.organizations = []
  })

  it("renders a static Personal label with no organizations", () => {
    render(<ContextSwitcher />)
    expect(screen.getByText("context.switcher.personal")).toBeTruthy()
    expect(screen.queryByRole("listbox")).toBeNull()
  })

  it("renders a dropdown listing the organizations", () => {
    state.organizations = [
      { id: "org-1", name: "Acme", slug: "acme" },
      { id: "org-2", name: "Beta", slug: "beta" },
    ]
    render(<ContextSwitcher />)
    fireEvent.click(screen.getByLabelText("context.switcher.title"))
    expect(screen.getByRole("listbox")).toBeTruthy()
    expect(screen.getByText("Acme")).toBeTruthy()
    expect(screen.getByText("Beta")).toBeTruthy()
  })

  it("calls switchContext when an organization is selected", () => {
    state.organizations = [{ id: "org-1", name: "Acme", slug: "acme" }]
    render(<ContextSwitcher />)
    fireEvent.click(screen.getByLabelText("context.switcher.title"))
    fireEvent.click(screen.getByText("Acme"))
    expect(state.switchContext).toHaveBeenCalledWith("org-1")
  })
})
