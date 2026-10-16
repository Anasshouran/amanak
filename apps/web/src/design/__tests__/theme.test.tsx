import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { ThemeProvider, useTheme } from "../ThemeProvider"

function Probe() {
  const { theme, locale, toggleTheme, toggleLocale } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="locale">{locale}</span>
      <button type="button" onClick={toggleTheme}>
        toggle-theme
      </button>
      <button type="button" onClick={toggleLocale}>
        toggle-locale
      </button>
    </div>
  )
}

describe("ThemeProvider", () => {
  it("defaults to light theme and Arabic locale and sets document attributes", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId("theme").textContent).toBe("light")
    expect(screen.getByTestId("locale").textContent).toBe("ar")
    expect(document.documentElement.getAttribute("data-theme")).toBe("light")
    expect(document.documentElement.getAttribute("lang")).toBe("ar")
    expect(document.documentElement.getAttribute("dir")).toBe("rtl")
  })

  it("toggles theme to dark and locale to English", async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole("button", { name: "toggle-theme" }))
    await user.click(screen.getByRole("button", { name: "toggle-locale" }))

    expect(screen.getByTestId("theme").textContent).toBe("dark")
    expect(screen.getByTestId("locale").textContent).toBe("en")
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    expect(document.documentElement.getAttribute("dir")).toBe("ltr")
    expect(localStorage.getItem("amanak.theme")).toBe("dark")
    expect(localStorage.getItem("amanak.locale")).toBe("en")
  })
})
