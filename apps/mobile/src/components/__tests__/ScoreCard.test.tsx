/** @vitest-environment jsdom */
import type { ScoreHistoryResponse } from "@amanak/shared-types"
import { beforeEach, describe, expect, it } from "vitest"
import { renderWithProviders } from "../../test/render"
import { ScoreCard } from "../ScoreCard"

function history(overrides: Partial<ScoreHistoryResponse>): ScoreHistoryResponse {
  return {
    range: "7d",
    from: "2026-01-01",
    to: "2026-01-07",
    points: [],
    current: 0,
    delta: 0,
    trend: "flat",
    ...overrides,
  }
}

describe("ScoreCard", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("labels a high score as good", () => {
    const rendered = renderWithProviders(<ScoreCard score={72} history={null} />)
    expect(rendered.text()).toContain("Good")
    rendered.unmount()
  })

  it("labels a low score as weak and reports the drop", () => {
    const rendered = renderWithProviders(
      <ScoreCard
        score={30}
        history={history({
          points: [
            { date: "2026-01-01", score: 48 },
            { date: "2026-01-05", score: 30 },
          ],
          current: 30,
          delta: -18,
          trend: "down",
        })}
      />,
    )
    expect(rendered.text()).toContain("Weak")
    expect(rendered.text()).toContain("-18")
    rendered.unmount()
  })
})
