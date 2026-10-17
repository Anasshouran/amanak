import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { TwoFactorRow } from "../TwoFactorRow"
import type { TwoFactorEntry } from "@amanak/shared-types"

function makeEntry(overrides: Partial<TwoFactorEntry> = {}): TwoFactorEntry {
  return {
    id: 1,
    label: "test-label",
    issuer: "Google",
    ciphertext: "dGVzdC1jaXBoZXJ0ZXh0",
    iv: "dGVzdC1pdi1kYXRh",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe("TwoFactorRow", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("renders issuer and label", () => {
    render(
      <ThemeProvider>
        <TwoFactorRow entry={makeEntry()} now={Date.now()} onEdit={vi.fn()} onDelete={vi.fn()} onCopy={vi.fn()} />
      </ThemeProvider>,
    )
    expect(screen.getByText("Google")).toBeInTheDocument()
    expect(screen.getByText("test-label")).toBeInTheDocument()
  })

  it("calls delete when delete button clicked", async () => {
    const onDelete = vi.fn()
    render(
      <ThemeProvider>
        <TwoFactorRow entry={makeEntry()} now={Date.now()} onEdit={vi.fn()} onDelete={onDelete} onCopy={vi.fn()} />
      </ThemeProvider>,
    )
    await userEvent.click(screen.getByRole("button", { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
