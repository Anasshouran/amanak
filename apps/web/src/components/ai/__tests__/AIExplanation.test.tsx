/** @vitest-environment jsdom */
import { describe, test, expect } from "vitest"
import { describe, test, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { AIExplanation } from "../AIExplanation.tsx"

describe("AIExplanation", () => {
  test("renders explanation text", () => {
    render(<AIExplanation text="Domain mimics PayPal" provider="ollama" model="llama3.1:8b" />)
    expect(screen.getByText(/Domain mimics PayPal/i)).toBeInTheDocument()
  })

  test("renders loading state", () => {
    render(<AIExplanation loading />)
    expect(screen.getByTestId("ai-loading")).toBeInTheDocument()
  })

  test("renders error state", () => {
    render(<AIExplanation error="timeout" />)
    expect(screen.getByText(/timeout/i)).toBeInTheDocument()
  })
})
