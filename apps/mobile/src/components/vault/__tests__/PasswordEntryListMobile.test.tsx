/** @vitest-environment jsdom */
import type { PasswordEntry } from "@amanak/shared-types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react-dom/test-utils"
import { fireEvent } from "@testing-library/dom"
import { renderWithProviders } from "../../../test/render"
import { PasswordEntryListMobile } from "../PasswordEntryListMobile"

vi.mock("expo-clipboard", () => ({ setStringAsync: vi.fn(async () => undefined) }))

const noop = () => undefined
const resolvePassword = vi.fn(async () => "s3cret")

const entry = (id: number, title: string): PasswordEntry => ({
  id,
  title,
  username: "user@example.com",
  url: "https://example.com",
  category: "banking",
  tags: [],
  ciphertext: "blob",
  iv: "blob",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
})

beforeEach(() => {
  window.localStorage.setItem("amanak.locale", "en")
  vi.clearAllMocks()
})

function typeIntoSearch(container: HTMLElement, value: string) {
  const input = container.querySelector("input")
  expect(input).not.toBeNull()
  act(() => {
    fireEvent.input(input as HTMLInputElement, { target: { value } })
  })
}

describe("PasswordEntryListMobile", () => {
  it("shows the empty state when there are no entries", () => {
    const rendered = renderWithProviders(
      <PasswordEntryListMobile
        entries={[]}
        onAdd={noop}
        onEdit={noop}
        onDelete={noop}
        onRevealPassword={resolvePassword}
      />,
    )
    expect(rendered.text()).toContain("Your vault is empty")
    rendered.unmount()
  })

  it("renders one card per entry", () => {
    const entries = [entry(1, "Alpha"), entry(2, "Beta"), entry(3, "Gamma")]
    const rendered = renderWithProviders(
      <PasswordEntryListMobile
        entries={entries}
        onAdd={noop}
        onEdit={noop}
        onDelete={noop}
        onRevealPassword={resolvePassword}
      />,
    )
    expect(rendered.text()).toContain("Alpha")
    expect(rendered.text()).toContain("Beta")
    expect(rendered.text()).toContain("Gamma")
    rendered.unmount()
  })

  it("filters entries by search", () => {
    const entries = [entry(1, "Foo entry"), entry(2, "Bar entry"), entry(3, "Baz entry")]
    const rendered = renderWithProviders(
      <PasswordEntryListMobile
        entries={entries}
        onAdd={noop}
        onEdit={noop}
        onDelete={noop}
        onRevealPassword={resolvePassword}
      />,
    )

    typeIntoSearch(rendered.container, "Foo")

    expect(rendered.text()).toContain("Foo entry")
    expect(rendered.text()).not.toContain("Bar entry")
    expect(rendered.text()).not.toContain("Baz entry")
    rendered.unmount()
  })
})
