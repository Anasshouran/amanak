import { render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { ActionCards } from "../ActionCards"

// react-router is hoisted to the monorepo root and pulls in a second react
// copy under vitest, so stub Link with a plain anchor.
vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

function renderCards(breachEnabled: boolean) {
  return render(
    <ThemeProvider>
      <ActionCards breachEnabled={breachEnabled} />
    </ThemeProvider>,
  )
}

describe("ActionCards", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("renders four action cards with the expected destinations", () => {
    renderCards(false)
    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(4)

    const hrefs = links.map((link) => link.getAttribute("href"))
    expect(hrefs).toEqual(["/scanner", "/breach", "/vault", "/passwords"])
  })

  it("shows Enable on the breach card when the monitor is off", () => {
    renderCards(false)
    const breach = screen.getByRole("link", { name: /Check Breach Monitor/ })
    expect(within(breach).getByText("Enable")).toBeInTheDocument()
  })

  it("switches the breach card to Check when enabled", () => {
    renderCards(true)
    const breach = screen.getByRole("link", { name: /Check Breach Monitor/ })
    expect(within(breach).getByText("Check")).toBeInTheDocument()
  })
})
