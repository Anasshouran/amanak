/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderWithProviders } from "../../test/render"
import { Greeting } from "../Greeting"

const auth = vi.hoisted(() => ({
  user: { username: "ada", email: "ada@example.com" } as { username: string; email: string },
}))

vi.mock("../../state/AuthContext", () => ({
  useAuth: () => ({ user: auth.user }),
}))

describe("Greeting", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
    auth.user = { username: "ada", email: "ada@example.com" }
  })

  it("greets in the morning", () => {
    const rendered = renderWithProviders(<Greeting now={new Date(2026, 0, 5, 8, 0, 0)} />)
    expect(rendered.text()).toContain("Good morning, ada")
    rendered.unmount()
  })

  it("falls back to the email local part when no username is set", () => {
    auth.user = { username: "", email: "ada@example.com" }
    const rendered = renderWithProviders(<Greeting now={new Date(2026, 0, 5, 20, 0, 0)} />)
    expect(rendered.text()).toContain("Good evening, ada")
    rendered.unmount()
  })
})
