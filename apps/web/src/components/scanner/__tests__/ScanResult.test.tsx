import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ScanMatch } from "@amanak/shared-types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { ScanResult, type ScanResultView } from "../ScanResult"

function match(id: string): ScanMatch {
  return {
    rule_id: id,
    severity: "high",
    description: `Matched ${id}`,
    evidence_redacted: "***",
  }
}

function view(overrides: Partial<ScanResultView> = {}): ScanResultView {
  return {
    verdict: "safe",
    score: 0,
    matches: [],
    rulesetVersion: "2024.1",
    input: "https://sub.example.com/path",
    scannedAt: new Date().toISOString(),
    ...overrides,
  }
}

function renderResult(props: Parameters<typeof ScanResult>[0]) {
  return render(
    <ThemeProvider>
      <ScanResult {...props} />
    </ThemeProvider>,
  )
}

describe("ScanResult", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("renders a Safe status for a safe verdict", () => {
    renderResult({ result: view() })
    expect(screen.getByRole("heading", { level: 2, name: "Safe" })).toBeInTheDocument()
    expect(document.querySelector(".amk-badge")).toHaveTextContent("Safe")
  })

  it("renders a Malicious status with a Dangerous badge for a dangerous verdict", () => {
    renderResult({ result: view({ verdict: "dangerous" }) })
    expect(screen.getByRole("heading", { level: 2, name: "Malicious" })).toBeInTheDocument()
    expect(document.querySelector(".amk-badge")).toHaveTextContent("Dangerous")
    expect(screen.getByText("High")).toBeInTheDocument()
  })

  it("shows the detail rows with a derived domain and unknown category", () => {
    renderResult({ result: view() })
    expect(screen.getByText("sub.example.com")).toBeInTheDocument()
    expect(screen.getByText("—")).toBeInTheDocument()
    expect(screen.getByText("Low")).toBeInTheDocument()
  })

  it("lists the matched indicators", () => {
    renderResult({ result: view({ verdict: "dangerous", matches: [match("r1"), match("r2")] }) })
    expect(document.querySelectorAll(".amk-match")).toHaveLength(2)
    expect(screen.getByText(/^Rule: r1$/)).toBeInTheDocument()
  })

  it("invokes the action callbacks", async () => {
    const onScanAnother = vi.fn()
    const onCopyReport = vi.fn()
    renderResult({ result: view(), onScanAnother, onCopyReport })
    await userEvent.click(screen.getByRole("button", { name: "Scan another" }))
    await userEvent.click(screen.getByRole("button", { name: "Copy report" }))
    expect(onScanAnother).toHaveBeenCalledTimes(1)
    expect(onCopyReport).toHaveBeenCalledTimes(1)
  })

  it("only offers the false-positive report for non-safe results", async () => {
    const onReportFalsePositive = vi.fn()
    const { rerender } = renderResult({ result: view(), onReportFalsePositive })
    expect(screen.queryByRole("button", { name: /false positive/i })).not.toBeInTheDocument()

    rerender(
      <ThemeProvider>
        <ScanResult
          result={view({ verdict: "suspicious" })}
          onReportFalsePositive={onReportFalsePositive}
        />
      </ThemeProvider>,
    )
    await userEvent.click(screen.getByRole("button", { name: /false positive/i }))
    expect(onReportFalsePositive).toHaveBeenCalledTimes(1)
  })
})
