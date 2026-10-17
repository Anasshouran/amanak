import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../ThemeProvider"
import { Nav, STAFF_SECTION_STORAGE_KEY } from "../Nav"

// react-router is hoisted to the monorepo root and pulls in a second react
// copy under vitest, so stub the pieces Nav uses with a plain anchor.
const router = vi.hoisted(() => ({ path: "/dashboard" }))

vi.mock("react-router-dom", () => ({
  useLocation: () => ({ pathname: router.path }),
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
  NavLink: ({
    to,
    children,
    className,
    end,
    onClick,
    ...rest
  }: {
    to: string
    children: ReactNode
    className?: (s: { isActive: boolean }) => string
    end?: boolean
    onClick?: () => void
    [key: string]: unknown
  }) => {
    const isActive = end
      ? router.path === to
      : router.path === to || router.path.startsWith(`${to}/`)
    return (
      <a
        href={to}
        onClick={onClick}
        aria-current={isActive ? "page" : undefined}
        className={typeof className === "function" ? className({ isActive }) : className}
        {...rest}
      >
        {children}
      </a>
    )
  },
}))

function renderNav(props: Partial<Parameters<typeof Nav>[0]> = {}) {
  return render(
    <ThemeProvider>
      <Nav {...props} />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem("amanak.locale", "en")
  router.path = "/dashboard"
})

describe("Nav — staff section", () => {
  it("hides the staff section for non-staff users", () => {
    const { container } = renderNav({ staff: false, roles: [] })

    expect(container.querySelector(".amk-navsection")).toBeNull()
    expect(container.querySelector('a[href="/staff"]')).toBeNull()
  })

  it("shows only the items a support agent may use", () => {
    const { container } = renderNav({ staff: true, roles: ["support"] })

    expect(container.querySelector('a[href="/staff"]')).toBeTruthy()
    expect(container.querySelector('a[href="/staff/users"]')).toBeTruthy()
    expect(container.querySelector('a[href="/staff/tickets"]')).toBeTruthy()
    expect(container.querySelector('a[href="/staff/metrics"]')).toBeTruthy()
    expect(container.querySelector('a[href="/staff/audit"]')).toBeNull()
    expect(container.querySelector('a[href="/staff/subscriptions"]')).toBeNull()
    expect(container.querySelector('a[href="/staff/announcements"]')).toBeNull()
  })

  it("adds audit tools for a security admin but not tickets or billing", () => {
    const { container } = renderNav({ staff: true, roles: ["security_admin"] })

    expect(container.querySelector('a[href="/staff/audit"]')).toBeTruthy()
    expect(container.querySelector('a[href="/staff/users"]')).toBeTruthy()
    expect(container.querySelector('a[href="/staff/tickets"]')).toBeNull()
    expect(container.querySelector('a[href="/staff/subscriptions"]')).toBeNull()
    expect(container.querySelector('a[href="/staff/announcements"]')).toBeNull()
  })

  it("adds subscriptions for a billing admin only", () => {
    const { container } = renderNav({ staff: true, roles: ["billing_admin"] })

    expect(container.querySelector('a[href="/staff/subscriptions"]')).toBeTruthy()
    expect(container.querySelector('a[href="/staff/metrics"]')).toBeTruthy()
    expect(container.querySelector('a[href="/staff/users"]')).toBeNull()
    expect(container.querySelector('a[href="/staff/audit"]')).toBeNull()
  })

  it("shows every staff item to a super admin", () => {
    const { container } = renderNav({ staff: true, roles: ["super_admin"] })

    for (const path of [
      "/staff",
      "/staff/users",
      "/staff/tickets",
      "/staff/audit",
      "/staff/metrics",
      "/staff/subscriptions",
      "/staff/announcements",
    ]) {
      expect(container.querySelector(`a[href="${path}"]`)).toBeTruthy()
    }
  })

  it("marks the active staff route", () => {
    router.path = "/staff/users"
    const { container } = renderNav({ staff: true, roles: ["super_admin"] })

    const active = container.querySelector('a[href="/staff/users"]')
    expect(active).toHaveAttribute("aria-current", "page")
    expect(active?.className).toContain("is-active")
  })

  it("renders the open-tickets badge only when there are tickets", () => {
    const { container } = renderNav({ staff: true, roles: ["support"], openTickets: 3 })
    expect(container.querySelector(".amk-navbadge")?.textContent).toBe("3")

    const { container: empty } = renderNav({ staff: true, roles: ["support"], openTickets: 0 })
    expect(empty.querySelector(".amk-navbadge")).toBeNull()
  })

  it("persists the collapsed state in localStorage", async () => {
    const user = userEvent.setup()
    const { container } = renderNav({ staff: true, roles: ["support"] })

    const toggle = screen.getByRole("button", { name: "Collapse staff menu" })
    expect(toggle).toHaveAttribute("aria-expanded", "true")

    await user.click(toggle)

    expect(window.localStorage.getItem(STAFF_SECTION_STORAGE_KEY)).toBe("true")
    expect(screen.getByRole("button", { name: "Expand staff menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    )
    expect(container.querySelector(".amk-navsection__items")).toBeNull()
  })

  it("restores a collapsed section on mount", () => {
    window.localStorage.setItem(STAFF_SECTION_STORAGE_KEY, "true")
    const { container } = renderNav({ staff: true, roles: ["support"] })

    expect(container.querySelector(".amk-navsection__items")).toBeNull()
    expect(screen.getByRole("button", { name: "Expand staff menu" })).toBeTruthy()
  })
})

describe("Nav — sidebar (P17.1)", () => {
  it("renders the sidebar with the navy token background", () => {
    const { container } = renderNav()

    const sidebar = container.querySelector<HTMLElement>(".amk-sidebar")
    expect(sidebar).toBeTruthy()
    expect(sidebar?.style.background).toContain("--c-sidebar-bg")
  })

  it("renders the personal group with billing and notifications", () => {
    const { container } = renderNav()

    expect(container.querySelector(".amk-navgroup")).toBeTruthy()
    expect(container.querySelector('a[href="/billing"]')).toBeTruthy()
    expect(container.querySelector('a[href="/notifications"]')).toBeTruthy()
    expect(container.querySelector('a[href="/passwords"]')).toBeTruthy()
  })

  it("does not use the staff-section class for the personal group", () => {
    const { container } = renderNav({ staff: false, roles: [] })
    expect(container.querySelector(".amk-navgroup .amk-navsection")).toBeNull()
  })

  it("marks the active personal route and exposes a tooltip title", () => {
    router.path = "/dashboard"
    const { container } = renderNav()

    const active = container.querySelector('a[href="/dashboard"]')
    expect(active).toHaveAttribute("aria-current", "page")
    expect(active?.className).toContain("is-active")
    expect(active).toHaveAttribute("title", "Dashboard")
  })

  it("shows the user area when a user is provided", () => {
    const { container } = renderNav({ user: { email: "ada@example.com", username: "ada" } })

    expect(container.querySelector(".amk-sidebar__user")).toBeTruthy()
    expect(screen.getByText("ada")).toBeTruthy()
  })

  it("shows the upgrade card below the brand for non-staff users", () => {
    const { container } = renderNav({ staff: false, roles: [] })

    const card = container.querySelector(".nav-upgrade-card")
    expect(card).toBeTruthy()
    expect(card?.textContent).toContain("Upgrade to Pro")
    expect(card?.querySelector(".nav-upgrade-icon")).toBeTruthy()
  })

  it("hides the upgrade card when showUpgrade is false", () => {
    const { container } = renderNav({ showUpgrade: false })
    expect(container.querySelector(".nav-upgrade-card")).toBeNull()
  })

  it("hides the upgrade card for staff users", () => {
    const { container } = renderNav({ staff: true, roles: ["support"] })
    expect(container.querySelector(".nav-upgrade-card")).toBeNull()
  })
})
