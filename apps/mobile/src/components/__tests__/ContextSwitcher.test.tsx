/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react-dom/test-utils"
import { renderWithProviders } from "../../test/render"
import { ContextSwitcher } from "../ContextSwitcher"

const state = vi.hoisted(() => ({
  contextId: null as string | null,
  contextName: "Personal",
  organizations: [] as Array<{ id: string; name: string; slug: string }>,
  switchContext: vi.fn(),
}))

vi.mock("../../design/ContextProvider", () => ({
  useContext_: () => ({
    contextId: state.contextId,
    contextName: state.contextName,
    organizations: state.organizations,
    loading: false,
    switchContext: state.switchContext,
  }),
}))

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

function pressAll(container: HTMLElement, label: string) {
  const nodes = Array.from(container.querySelectorAll("*")).filter(
    (node) => node.getAttribute("aria-label") === label,
  )
  expect(nodes.length).toBeGreaterThan(0)
  act(() => {
    ;(nodes[0] as HTMLElement).click()
  })
}

function bodyText(): string {
  return (document.body.textContent ?? "").replace(/\s+/g, " ").trim()
}

describe("mobile ContextSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.localStorage.setItem("amanak.locale", "en")
    state.contextId = null
    state.organizations = []
  })

  it("shows the current name and switches when an org is selected", () => {
    state.organizations = [{ id: "org-1", name: "Acme", slug: "acme" }]
    const rendered = renderWithProviders(<ContextSwitcher />)

    // Trigger renders the current context name.
    expect(rendered.text()).toContain("Personal")

    // Open the sheet.
    pressAll(rendered.container, "Switch workspace")
    expect(bodyText()).toContain("Acme")

    // Tap the org row (rendered as a menuitem).
    const options = Array.from(document.querySelectorAll('[role="menuitem"]'))
    expect(options.length).toBeGreaterThan(0)
    act(() => {
      ;(options[options.length - 1] as HTMLElement).click()
    })
    expect(state.switchContext).toHaveBeenCalledWith("org-1")
    rendered.unmount()
  })
})
