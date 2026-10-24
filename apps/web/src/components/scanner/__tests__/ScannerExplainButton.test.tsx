/** @vitest-environment jsdom */
import { describe, test, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ScannerExplainButton } from "../ScannerExplainButton"

describe("ScannerExplainButton", () => {
  test("disabled when AI off", () => {
    render(<ScannerExplainButton aiEnabled={false} onExplain={() => undefined} />)
    expect(screen.getByRole("button", { name: /explain/i })).toBeDisabled()
  })

  test("calls API when clicked", () => {
    const onExplain = vi.fn()
    render(<ScannerExplainButton aiEnabled={true} onExplain={onExplain} />)
    fireEvent.click(screen.getByRole("button", { name: /explain/i }))
    expect(onExplain).toHaveBeenCalled()
  })
})
