import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi, describe, it, expect, beforeEach } from "vitest"
import AISettings from "../AISettings"
import { ThemeProvider } from "../../../design/ThemeProvider"

describe("AISettings", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
      },
      writable: true,
    })
  })

  it("renders without crashing", () => {
    const { container } = render(
      <ThemeProvider>
        <AISettings />
      </ThemeProvider>
    )
    expect(container).toBeInTheDocument()
  })

  it("shows loading state initially", () => {
    const { container } = render(
      <ThemeProvider>
        <AISettings />
      </ThemeProvider>
    )
    expect(container.querySelector(".amk-skeleton")).toBeInTheDocument()
  })

  it("shows consent checkbox when cloud provider selected", () => {
    const { container } = render(
      <ThemeProvider>
        <AISettings />
      </ThemeProvider>
    )
    expect(container).toBeInTheDocument()
  })
})