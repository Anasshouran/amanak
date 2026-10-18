/** @vitest-environment jsdom */
import type { TwoFactorEntry } from "@amanak/shared-types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react-dom/test-utils"
import { setStringAsync } from "expo-clipboard"
import { renderWithProviders } from "../../../test/render"
import { TwoFactorCard } from "../TwoFactorCard"

vi.mock("expo-clipboard", () => ({ setStringAsync: vi.fn(async () => undefined) }))

const entry: TwoFactorEntry = {
  id: 7,
  label: "me@example.com",
  issuer: "GitHub",
  ciphertext: "b64-ciphertext",
  iv: "b64-iv",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

const noop = () => undefined

describe("TwoFactorCard", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("renders the issuer, label and the revealed code", () => {
    const hidden = renderWithProviders(
      <TwoFactorCard
        entry={entry}
        code="123456"
        secondsRemaining={30}
        revealed={false}
        onToggleReveal={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    )
    expect(hidden.text()).toContain("GitHub")
    expect(hidden.text()).toContain("me@example.com")
    // Single-reveal: the digits stay masked until the card is revealed.
    expect(hidden.text()).toContain("••• •••")
    expect(hidden.text()).not.toContain("123 456")
    hidden.unmount()

    const shown = renderWithProviders(
      <TwoFactorCard
        entry={entry}
        code="123456"
        secondsRemaining={30}
        revealed
        onToggleReveal={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    )
    expect(shown.text()).toContain("123 456")
    shown.unmount()
  })

  it("renders the countdown for the current window", () => {
    const rendered = renderWithProviders(
      <TwoFactorCard
        entry={entry}
        code="123456"
        secondsRemaining={23}
        revealed
        onToggleReveal={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    )
    expect(rendered.text()).toContain("Expires in 23s")
    rendered.unmount()
  })

  it("copies the raw code without the display space", async () => {
    const rendered = renderWithProviders(
      <TwoFactorCard
        entry={entry}
        code="123456"
        secondsRemaining={12}
        revealed
        onToggleReveal={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    )

    const copy = rendered.container.querySelector('[aria-label="Copy code for GitHub"]')
    expect(copy).not.toBeNull()

    await act(async () => {
      ;(copy as HTMLElement).click()
    })

    expect(setStringAsync).toHaveBeenCalledWith("123456")
    rendered.unmount()
  })
})
