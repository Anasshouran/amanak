/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react-dom/test-utils"

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() },
  setItem: vi.fn(),
  getItem: vi.fn(),
  removeItem: vi.fn(),
}))

vi.mock("../../../lib/api", () => ({
  api: { post: vi.fn() },
}))

import { renderWithProviders } from "../../../test/render"
import { InvitationsAcceptScreen } from "../InvitationsAcceptScreen"

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

function clickByText(container: HTMLElement, needle: string) {
  const nodes = Array.from(container.querySelectorAll('[role="button"]'))
  const target = nodes.find((n) => (n.textContent ?? "").includes(needle))
  if (!target) throw new Error(`no button containing ${needle}`)
  act(() => {
    ;(target as HTMLElement).click()
  })
}

describe("InvitationsAcceptScreen", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
    vi.clearAllMocks()
  })

  it("accepts the invitation only after the button is pressed", async () => {
    const { api } = await import("../../../lib/api")
    ;(api.post as any).mockResolvedValue({ organization: { id: "org-1" }, role: "employee" })

    const rendered = renderWithProviders(<InvitationsAcceptScreen token="tok-123" />)
    await flush()
    expect(api.post).not.toHaveBeenCalled()

    clickByText(rendered.container, "Accept")
    await flush()

    expect(api.post).toHaveBeenCalledWith("/organizations/invitations/accept/", {
      token: "tok-123",
    })
    expect(rendered.text()).toContain("You are now a member.")
    rendered.unmount()
  })

  it("shows the expired message for an expired invitation", async () => {
    const { api } = await import("../../../lib/api")
    ;(api.post as any).mockRejectedValue({ code: "invitation_expired" })

    const rendered = renderWithProviders(<InvitationsAcceptScreen token="expired" />)
    await flush()

    clickByText(rendered.container, "Accept")
    await flush()

    expect(rendered.text()).toContain("This invitation has expired")
    rendered.unmount()
  })
})
