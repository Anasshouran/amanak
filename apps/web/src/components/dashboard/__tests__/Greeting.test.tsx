import { render, screen } from "@testing-library/react"
import type { User } from "@amanak/shared-types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { Greeting } from "../Greeting"

const auth = vi.hoisted(() => ({
  user: { username: "ada", email: "ada@example.com" } as Partial<User> | null,
}))

vi.mock("../../../state/AuthContext", () => ({
  useAuth: () => ({ user: auth.user }),
}))

function renderGreeting(now: Date) {
  return render(
    <ThemeProvider>
      <Greeting now={now} />
    </ThemeProvider>,
  )
}

describe("Greeting", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
    auth.user = { username: "ada", email: "ada@example.com" }
  })

  it("greets in the morning", () => {
    renderGreeting(new Date(2026, 0, 5, 8, 0, 0))
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Good morning, ada")
  })

  it("greets in the afternoon", () => {
    renderGreeting(new Date(2026, 0, 5, 14, 0, 0))
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Good afternoon, ada")
  })

  it("greets in the evening", () => {
    renderGreeting(new Date(2026, 0, 5, 20, 0, 0))
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Good evening, ada")
  })

  it("falls back to the email local part when username is empty", () => {
    auth.user = { username: "", email: "grace@example.com" }
    renderGreeting(new Date(2026, 0, 5, 8, 0, 0))
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Good morning, grace")
  })
})
