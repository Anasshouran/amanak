import { render, screen } from "@testing-library/react"
import type { ScanResultRecord } from "@amanak/shared-types"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { ActivityFeed } from "../ActivityFeed"

// react-router is hoisted to the monorepo root and pulls in a second react
// copy under vitest, so stub Link with a plain anchor.
vi.mock("react-router-dom", () => ({
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))

function scan(id: number, verdict: ScanResultRecord["verdict"]): ScanResultRecord {
  return {
    id,
    kind: "url",
    verdict,
    score: 10,
    matches: [],
    ruleset_version: "test",
    preview: `https://example.com/${id}`,
    created_at: new Date(Date.now() - id * 3_600_000).toISOString(),
  }
}

function renderFeed(items: ScanResultRecord[]) {
  return render(
    <ThemeProvider>
      <ActivityFeed items={items} />
    </ThemeProvider>,
  )
}

describe("ActivityFeed", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("renders up to five recent items as list items", () => {
    renderFeed([1, 2, 3, 4, 5, 6, 7].map((id) => scan(id, "safe")))
    expect(screen.getAllByRole("listitem")).toHaveLength(5)
  })

  it("shows the verdict label for each item", () => {
    renderFeed([scan(1, "dangerous")])
    expect(screen.getByText("Dangerous")).toBeInTheDocument()
  })

  it("shows an empty state when there is no activity", () => {
    renderFeed([])
    expect(screen.getByText("No recent activity.")).toBeInTheDocument()
    expect(screen.queryAllByRole("listitem")).toHaveLength(0)
  })
})
