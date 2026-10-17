import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { TotpDisplay } from "../TotpDisplay"
import type { TwoFactorEntry } from "@amanak/shared-types"

function entry(overrides: Partial<TwoFactorEntry> = {}): TwoFactorEntry {
  return {
    id: 1,
    label: "test",
    issuer: "Google",
    ciphertext: "dGVzdC1jaXBoZXJ0ZXh0",
    iv: "dGVzdC1pdi1kYXRh",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe("TotpDisplay", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("renders code in LTR direction", () => {
    render(
      <ThemeProvider>
        <TotpDisplay entry={entry()} now={Date.now()} onCopy={vi.fn()} />
      </ThemeProvider>,
    )
    expect(document.querySelector(".vault-2fa-code")).toBeInTheDocument()
  })

  it("shows countdown text with localized format", () => {
    render(
      <ThemeProvider>
        <TotpDisplay entry={entry()} now={Date.now()} onCopy={vi.fn()} />
      </ThemeProvider>,
    )
    expect(screen.getByText(/Expires in/)).toBeInTheDocument()
  })
})
