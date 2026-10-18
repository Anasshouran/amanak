/** @vitest-environment jsdom */
import type { PasswordEntry } from "@amanak/shared-types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react-dom/test-utils"
import * as Clipboard from "expo-clipboard"
import { renderWithProviders } from "../../../test/render"
import { PasswordEntryCard } from "../PasswordEntryCard"

vi.mock("expo-clipboard", () => ({ setStringAsync: vi.fn(async () => undefined) }))

const entry: PasswordEntry = {
  id: 3,
  title: "Example",
  username: "me@example.com",
  url: "https://example.com",
  category: "banking",
  tags: [],
  ciphertext: "blob",
  iv: "blob",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

const noop = () => undefined
const resolveCopy = vi.fn(async () => "s3cret")

beforeEach(() => {
  window.localStorage.setItem("amanak.locale", "en")
  vi.clearAllMocks()
  resolveCopy.mockResolvedValue("s3cret")
})

describe("PasswordEntryCard", () => {
  it("shows the masked password by default", () => {
    const rendered = renderWithProviders(
      <PasswordEntryCard
        entry={entry}
        password={null}
        revealed={false}
        onReveal={noop}
        onMask={noop}
        onEdit={noop}
        onDelete={noop}
        onCopy={resolveCopy}
      />,
    )
    expect(rendered.text()).toContain("••••••••")
    expect(rendered.text()).not.toContain("s3cret")
    rendered.unmount()
  })

  it("shows the plaintext when revealed", () => {
    const rendered = renderWithProviders(
      <PasswordEntryCard
        entry={entry}
        password="s3cret"
        revealed={true}
        onReveal={noop}
        onMask={noop}
        onEdit={noop}
        onDelete={noop}
        onCopy={resolveCopy}
      />,
    )
    expect(rendered.text()).toContain("s3cret")
    rendered.unmount()
  })

  it("copies the plaintext to the clipboard", async () => {
    const rendered = renderWithProviders(
      <PasswordEntryCard
        entry={entry}
        password="s3cret"
        revealed={true}
        onReveal={noop}
        onMask={noop}
        onEdit={noop}
        onDelete={noop}
        onCopy={resolveCopy}
      />,
    )

    const copy = rendered.container.querySelector('[aria-label="Copy password for Example"]')
    expect(copy).not.toBeNull()

    await act(async () => {
      ;(copy as HTMLElement).click()
    })

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("s3cret")
    rendered.unmount()
  })

  it("opens the ellipsis menu with Edit / Delete", () => {
    const rendered = renderWithProviders(
      <PasswordEntryCard
        entry={entry}
        password={null}
        revealed={false}
        onReveal={noop}
        onMask={noop}
        onEdit={noop}
        onDelete={noop}
        onCopy={resolveCopy}
      />,
    )

    const ellipsis = rendered.container.querySelector('[aria-label="Entry actions"]')
    expect(ellipsis).not.toBeNull()
    expect(rendered.text()).not.toContain("Edit")

    act(() => {
      ;(ellipsis as HTMLElement).click()
    })

    expect(rendered.text()).toContain("Edit")
    expect(rendered.text()).toContain("Delete")
    rendered.unmount()
  })
})
