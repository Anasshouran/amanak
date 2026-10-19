import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { AnswerFeedback } from "../AnswerFeedback"

describe("AnswerFeedback", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("shows the correct verdict and explanation", () => {
    render(
      <ThemeProvider>
        <AnswerFeedback isCorrect={true} explanation="Good job" onNext={() => {}} />
      </ThemeProvider>,
    )
    expect(screen.getByText("Correct")).toBeInTheDocument()
    expect(screen.getByText("Good job")).toBeInTheDocument()
  })

  it("shows red flags when provided", () => {
    render(
      <ThemeProvider>
        <AnswerFeedback
          isCorrect={false}
          explanation="Nope"
          redFlags={["urgent tone", "fake link"]}
          onNext={() => {}}
        />
      </ThemeProvider>,
    )
    expect(screen.getByText("urgent tone")).toBeInTheDocument()
    expect(screen.getByText("fake link")).toBeInTheDocument()
  })
})
