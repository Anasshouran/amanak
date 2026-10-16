import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { ScanTabs } from "../ScanTabs"
import type { ScanKind } from "@amanak/shared-types"

function renderTabs(value: ScanKind, onChange: (kind: ScanKind) => void) {
  return render(
    <ThemeProvider>
      <ScanTabs value={value} onChange={onChange} />
    </ThemeProvider>,
  )
}

describe("ScanTabs", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
    document.documentElement.dir = "ltr"
  })

  it("renders a tablist with both scan modes", () => {
    renderTabs("url", vi.fn())
    expect(screen.getByRole("tablist")).toBeInTheDocument()
    expect(screen.getAllByRole("tab")).toHaveLength(2)
    expect(screen.getByRole("tab", { name: "URL Scan" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Message Scan" })).toHaveAttribute(
      "aria-selected",
      "false",
    )
  })

  it("calls onChange when the other tab is clicked", async () => {
    const onChange = vi.fn()
    renderTabs("url", onChange)
    await userEvent.click(screen.getByRole("tab", { name: "Message Scan" }))
    expect(onChange).toHaveBeenCalledWith("message")
  })

  it("moves the selection with the arrow keys", async () => {
    const onChange = vi.fn()
    renderTabs("url", onChange)
    screen.getByRole("tab", { name: "URL Scan" }).focus()
    await userEvent.keyboard("{ArrowRight}")
    expect(onChange).toHaveBeenCalledWith("message")
  })

  it("keeps only the active tab in the tab order", () => {
    renderTabs("message", vi.fn())
    expect(screen.getByRole("tab", { name: "Message Scan" })).toHaveAttribute("tabindex", "0")
    expect(screen.getByRole("tab", { name: "URL Scan" })).toHaveAttribute("tabindex", "-1")
  })
})
