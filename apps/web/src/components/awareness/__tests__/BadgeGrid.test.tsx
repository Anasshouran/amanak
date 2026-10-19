import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { BadgeGrid } from "../BadgeGrid"

describe("BadgeGrid", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("renders all badges", () => {
    render(
      <ThemeProvider>
        <BadgeGrid
          badges={[
            { id: "a", title: "First", earned: true },
            { id: "b", title: "Second", earned: false },
          ]}
        />
      </ThemeProvider>,
    )
    expect(screen.getByText("First")).toBeInTheDocument()
    expect(screen.getByText("Second")).toBeInTheDocument()
  })

  it("shows earned and locked labels", () => {
    render(
      <ThemeProvider>
        <BadgeGrid
          badges={[
            { id: "a", title: "First", earned: true },
            { id: "b", title: "Second", earned: false },
          ]}
        />
      </ThemeProvider>,
    )
    expect(screen.getByText("Earned")).toBeInTheDocument()
    expect(screen.getByText("Locked")).toBeInTheDocument()
  })
})
