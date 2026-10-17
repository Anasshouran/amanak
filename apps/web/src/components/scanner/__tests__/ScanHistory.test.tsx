import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ScanResultRecord } from "@amanak/shared-types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { ScanHistory } from "../ScanHistory"

function record(overrides: Partial<ScanResultRecord> = {}): ScanResultRecord {
  return {
    id: 1,
    kind: "url",
    verdict: "safe",
    score: 0,
    matches: [],
    ruleset_version: "2024.1",
    preview: "https://example.com",
    created_at: new Date(Date.now() - 3_600_000).toISOString(),
    ...overrides,
  }
}

function renderHistory(items: ScanResultRecord[], onSelect?: (item: ScanResultRecord) => void) {
  return render(
    <ThemeProvider>
      <ScanHistory items={items} onSelect={onSelect} />
    </ThemeProvider>,
  )
}

describe("ScanHistory", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("shows an empty state when there are no scans", () => {
    renderHistory([])
    expect(screen.getByText("No scans yet.")).toBeInTheDocument()
    expect(screen.queryAllByRole("listitem")).toHaveLength(0)
  })

  it("renders each scan with its preview and localized verdict", () => {
    renderHistory([
      record({ id: 1, verdict: "safe", preview: "https://a.example" }),
      record({ id: 2, verdict: "dangerous", preview: "https://b.example" }),
    ])
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.getByText("https://a.example")).toBeInTheDocument()
    expect(screen.getByText("https://b.example")).toBeInTheDocument()
    expect(screen.getByText(/Safe/)).toBeInTheDocument()
    expect(screen.getByText(/Dangerous/)).toBeInTheDocument()
  })

  it("exposes the verdict on each row for color coding", () => {
    renderHistory([record({ id: 1, verdict: "suspicious" })])
    expect(document.querySelector(".scan-history__button")).toHaveAttribute(
      "data-verdict",
      "suspicious",
    )
  })

  it("calls onSelect with the chosen scan", async () => {
    const onSelect = vi.fn()
    const item = record({ id: 7, preview: "https://pick.example" })
    renderHistory([item], onSelect)
    await userEvent.click(screen.getByRole("button", { name: /https:\/\/pick\.example/ }))
    expect(onSelect).toHaveBeenCalledWith(item)
  })
})
