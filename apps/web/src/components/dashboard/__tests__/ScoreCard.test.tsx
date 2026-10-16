import { render, screen } from "@testing-library/react"
import type { ScoreHistoryResponse } from "@amanak/shared-types"
import { beforeEach, describe, expect, it } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { ScoreCard } from "../ScoreCard"

function history(delta: number, trend: "up" | "down" | "flat"): ScoreHistoryResponse {
  return {
    range: "7d",
    from: "2026-01-01",
    to: "2026-01-07",
    points: [
      { date: "2026-01-01", score: 60 },
      { date: "2026-01-07", score: 60 + delta },
    ],
    current: 60 + delta,
    delta,
    trend,
  }
}

function renderScoreCard(score: number, h: ScoreHistoryResponse | null) {
  return render(
    <ThemeProvider>
      <ScoreCard score={score} history={h} />
    </ThemeProvider>,
  )
}

describe("ScoreCard", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("renders the score, status and delta with an accessible label", () => {
    renderScoreCard(78, history(12, "up"))

    expect(screen.getByText("78")).toBeInTheDocument()
    expect(screen.getByText("Good")).toBeInTheDocument()
    expect(screen.getByText("+12")).toBeInTheDocument()
    expect(
      screen.getByRole("img", { name: "Security score 78 out of 100, Good" }),
    ).toBeInTheDocument()
  })

  it("colors the status by level", () => {
    const good = renderScoreCard(80, null)
    expect(screen.getByText("Good")).toHaveAttribute("data-level", "good")
    good.unmount()

    renderScoreCard(55, null)
    expect(screen.getByText("Fair")).toHaveAttribute("data-level", "fair")
  })

  it("marks a low score as weak", () => {
    renderScoreCard(20, history(-5, "down"))
    expect(screen.getByText("Weak")).toHaveAttribute("data-level", "weak")
    expect(screen.getByRole("img", { name: /Security score 20 out of 100, Weak/ })).toBeInTheDocument()
  })

  it("shows a skeleton while loading", () => {
    const { container } = render(
      <ThemeProvider>
        <ScoreCard score={0} history={null} loading />
      </ThemeProvider>,
    )
    expect(container.querySelector(".amk-skeleton")).toBeTruthy()
  })
})
