import { render, screen } from "@testing-library/react"
import type { ScanMatch } from "@amanak/shared-types"
import { beforeEach, describe, expect, it } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { IndicatorList } from "../IndicatorList"

function match(id: string, severity: ScanMatch["severity"] = "high"): ScanMatch {
  return {
    rule_id: id,
    severity,
    description: `Matched rule ${id}`,
    evidence_redacted: "***",
  }
}

function renderList(matches: ScanMatch[]) {
  return render(
    <ThemeProvider>
      <IndicatorList matches={matches} />
    </ThemeProvider>,
  )
}

describe("IndicatorList", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("shows a no-issues message when there are no matches", () => {
    renderList([])
    expect(screen.getByText("No issues found.")).toBeInTheDocument()
    expect(document.querySelectorAll(".amk-match")).toHaveLength(0)
  })

  it("renders one expandable row per match", () => {
    renderList([match("rule.a"), match("rule.b"), match("rule.c")])
    expect(document.querySelectorAll(".amk-match")).toHaveLength(3)
  })

  it("shows the rule id and a severity badge", () => {
    renderList([match("rule.url.shortener", "critical")])
    expect(screen.getByText(/^Rule: rule\.url\.shortener$/)).toBeInTheDocument()
    expect(screen.getByText("Critical")).toBeInTheDocument()
  })

  it("exposes the indicator list as a labelled region", () => {
    renderList([match("rule.a")])
    expect(screen.getByRole("region", { name: "Indicators" })).toBeInTheDocument()
  })
})
