/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react-dom/test-utils"

const state = vi.hoisted(() => ({
  pending: [] as unknown[],
  organizationRole: "owner" as string,
}))

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() },
  setItem: vi.fn(),
  getItem: vi.fn(),
  removeItem: vi.fn(),
}))

vi.mock("../../../lib/api", () => ({
  api: {
    get: vi.fn(() => Promise.resolve(state.pending)),
    post: vi.fn(() => Promise.resolve({})),
    delete: vi.fn(() => Promise.resolve({})),
  },
}))

import { renderWithProviders } from "../../../test/render"
import { OrgMembersCard } from "../OrgMembersCard"

const members = [
  {
    user_id: 1,
    email: "owner@example.com",
    display_name: "Owner",
    role: "owner" as const,
    joined_at: "2026-01-01T00:00:00Z",
  },
  {
    user_id: 2,
    email: "staff@example.com",
    role: "employee" as const,
    joined_at: "2026-01-02T00:00:00Z",
  },
]

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

describe("OrgMembersCard", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
    state.pending = []
    vi.clearAllMocks()
  })

  it("shows the invite action to a manager only", async () => {
    const asOwner = renderWithProviders(
      <OrgMembersCard orgId="org-1" role="owner" members={members} />,
    )
    await flush()
    expect(asOwner.text()).toContain("Invite")
    asOwner.unmount()

    const asAnalyst = renderWithProviders(
      <OrgMembersCard orgId="org-1" role="analyst" members={members} />,
    )
    await flush()
    expect(asAnalyst.text()).not.toContain("Invite")
    expect(asAnalyst.text()).toContain("staff@example.com")
    asAnalyst.unmount()
  })

  it("sends an invitation and lists pending invitations with revoke", async () => {
    const { api } = await import("../../../lib/api")
    ;(api.post as any).mockResolvedValue({})

    const rendered = renderWithProviders(
      <OrgMembersCard orgId="org-1" role="owner" members={members} />,
    )
    await flush()

    clickByText(rendered.container, "Invite")

    const input = rendered.container.querySelector("input") as HTMLInputElement
    expect(input).toBeTruthy()
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!
      setter.call(input, "new@example.com")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })

    clickByText(rendered.container, "Send invite")
    await flush()

    expect(api.post).toHaveBeenCalledWith("/organizations/org-1/members/invite/", {
      email: "new@example.com",
      role: "employee",
    })

    rendered.unmount()

    // Pending invitations are fetched separately and can be revoked.
    state.pending = [
      { id: 9, email: "pending@example.com", role: "employee", status: "pending" },
    ]
    const withPending = renderWithProviders(
      <OrgMembersCard orgId="org-1" role="owner" members={members} />,
    )
    await flush()
    expect(withPending.text()).toContain("pending@example.com")

    clickByText(withPending.container, "Revoke")
    await flush()
    expect(api.delete).toHaveBeenCalledWith("/organizations/org-1/invitations/9/")
    withPending.unmount()
  })
})
