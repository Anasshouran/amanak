/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest"
import { renderWithProviders } from "../../../test/render"
import { ScanResult, type ScanResultView } from "../ScanResult"

function view(overrides: Partial<ScanResultView> = {}): ScanResultView {
  return {
    verdict: "safe",
    score: 0,
    matches: [],
    rulesetVersion: "rules-1",
    input: "https://example.com/login",
    scannedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }
}

describe("ScanResult", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("renders the safe, suspicious and dangerous states", () => {
    const safe = renderWithProviders(<ScanResult result={view()} />)
    expect(safe.text()).toContain("Safe")
    expect(safe.text()).toContain("This URL looks safe")
    safe.unmount()

    const suspicious = renderWithProviders(<ScanResult result={view({ verdict: "suspicious" })} />)
    expect(suspicious.text()).toContain("Suspicious")
    expect(suspicious.text()).toContain("Some indicators suggest")
    suspicious.unmount()

    const dangerous = renderWithProviders(<ScanResult result={view({ verdict: "dangerous" })} />)
    // Headline says "Malicious" while the badge says "Dangerous" — the same
    // split the web client uses.
    expect(dangerous.text()).toContain("Malicious")
    expect(dangerous.text()).toContain("Dangerous")
    expect(dangerous.text()).toContain("Do not visit it")
    dangerous.unmount()
  })

  it("lists every indicator with its severity and resolves the domain", () => {
    const rendered = renderWithProviders(
      <ScanResult
        result={view({
          verdict: "dangerous",
          input: "https://paypa1-secure.tk/login",
          matches: [
            {
              rule_id: "phish.lookalike",
              severity: "high",
              description: "Lookalike domain",
              evidence_redacted: "paypa1-secure.tk",
            },
            {
              rule_id: "url.http",
              severity: "low",
              description: "Plain HTTP link",
              evidence_redacted: "http://",
            },
          ],
        })}
      />,
    )
    const text = rendered.text()
    expect(text).toContain("Risk Level")
    expect(text).toContain("paypa1-secure.tk")
    expect(text).toContain("phish.lookalike")
    expect(text).toContain("Lookalike domain")
    expect(text).toContain("Plain HTTP link")
    // Severity badges come from the shared ramp, not verdict colours.
    expect(text).toContain("High")
    expect(text).toContain("Low")
    rendered.unmount()

    const clean = renderWithProviders(<ScanResult result={view()} />)
    expect(clean.text()).toContain("No issues found")
    clean.unmount()
  })

  it("shows the skeleton while scanning and the retry state on failure", () => {
    const loading = renderWithProviders(<ScanResult result={null} loading />)
    expect(loading.container.querySelector('[data-testid="scan-result-loading"]')).not.toBeNull()
    expect(loading.text()).not.toContain("Safe")
    loading.unmount()

    const failed = renderWithProviders(
      <ScanResult result={null} error="Network unavailable" onRetry={() => undefined} />,
    )
    expect(failed.text()).toContain("Network unavailable")
    expect(failed.text()).toContain("Try again")
    expect(failed.text()).not.toContain("Risk Level")
    failed.unmount()
  })
})
