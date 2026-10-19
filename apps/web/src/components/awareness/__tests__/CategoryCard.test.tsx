import { render, screen, fireEvent } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { CategoryCard } from "../CategoryCard"

describe("CategoryCard", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("renders the title and progress", () => {
    render(
      <ThemeProvider>
        <CategoryCard id="email" title="Email phishing" attempted={3} total={10} onStart={() => {}} />
      </ThemeProvider>,
    )
    expect(screen.getByText("Email phishing")).toBeInTheDocument()
    expect(screen.getByText("3/10")).toBeInTheDocument()
  })

  it("calls onStart with the category id when clicked", () => {
    const onStart = vi.fn()
    render(
      <ThemeProvider>
        <CategoryCard id="email" title="Email phishing" attempted={0} total={10} onStart={onStart} />
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: /Start/i }))
    expect(onStart).toHaveBeenCalledWith("email")
  })
})
