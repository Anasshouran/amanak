import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ScoreHistoryResponse } from "@amanak/shared-types"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { TrendCard } from "../TrendCard"

const getSecurityScoreHistory = vi.hoisted(() => vi.fn())

vi.mock("../../../lib/api", () => ({
  api: { getSecurityScoreHistory },
}))

function response(range: ScoreHistoryResponse["range"], count: number): ScoreHistoryResponse {
  const points = Array.from({ length: count }, (_, index) => {
    const d = new Date(2026, 0, 1 + index)
    const iso = d.toISOString().slice(0, 10)
    return {
      date: iso,
      score: 60 + index,
    }
  })
  return {
    range,
    from: points[0]?.date ?? "",
    to: points[points.length - 1]?.date ?? "",
    points,
    current: points[points.length - 1]?.score ?? 0,
    delta: 4,
    trend: "up",
  }
}

function renderTrend() {
  return render(
    <ThemeProvider>
      <TrendCard />
    </ThemeProvider>,
  )
}

describe("TrendCard", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
    getSecurityScoreHistory.mockReset()
  })

  it("shows a skeleton first, then the chart", async () => {
    let resolve!: (value: ScoreHistoryResponse) => void
    getSecurityScoreHistory.mockReturnValue(
      new Promise<ScoreHistoryResponse>((r) => {
        resolve = r
      }),
    )

    const { container } = renderTrend()
    expect(container.querySelector(".amk-skeleton")).toBeTruthy()

    resolve(response("30d", 30))
    await waitFor(() => expect(container.querySelector("table.sr-only")).toBeTruthy())
    expect(screen.getByRole("img", { name: /Security score trend/ })).toBeInTheDocument()
  })

  it("refetches when the range changes", async () => {
    getSecurityScoreHistory.mockResolvedValue(response("30d", 30))
    const user = userEvent.setup()
    renderTrend()

    await waitFor(() => expect(getSecurityScoreHistory).toHaveBeenCalledWith("30d"))

    await user.click(screen.getByRole("tab", { name: "7 days" }))
    await waitFor(() => expect(getSecurityScoreHistory).toHaveBeenCalledWith("7d"))
  })

  it("shows an empty state when there is not enough history", async () => {
    getSecurityScoreHistory.mockResolvedValue(response("30d", 1))
    renderTrend()
    expect(await screen.findByText("Not enough data yet. It will appear here after a few days.")).toBeInTheDocument()
  })
})
