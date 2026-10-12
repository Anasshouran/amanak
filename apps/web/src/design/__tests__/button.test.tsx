import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Button } from "../components/Button"

describe("Button", () => {
  it("renders its label and applies the variant and size classes", () => {
    render(
      <Button variant="danger" size="sm">
        Delete
      </Button>,
    )
    const button = screen.getByRole("button", { name: "Delete" })
    expect(button.className).toContain("amk-btn--danger")
    expect(button.className).toContain("amk-btn--sm")
  })

  it("is disabled and marked busy while loading", () => {
    render(<Button loading>Saving</Button>)
    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("aria-busy", "true")
  })
})
