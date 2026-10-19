import { render, screen, fireEvent } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { AnswerButtons } from "../AnswerButtons"

describe("AnswerButtons", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("renders three answer buttons", () => {
    render(
      <ThemeProvider>
        <AnswerButtons onAnswer={() => {}} />
      </ThemeProvider>,
    )
    expect(screen.getByRole("button", { name: /Safe/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Phishing/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Not sure/i })).toBeInTheDocument()
  })

  it("calls onAnswer with the clicked answer", () => {
    const onAnswer = vi.fn()
    render(
      <ThemeProvider>
        <AnswerButtons onAnswer={onAnswer} />
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByRole("button", { name: /Phishing/i }))
    expect(onAnswer).toHaveBeenCalledWith("phishing")
  })
})
