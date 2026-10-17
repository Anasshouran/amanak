import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { RevealTimer } from "../RevealTimer"

describe("RevealTimer", () => {
  it("counts down", async () => {
    render(<RevealTimer active durationMs={2000} onExpire={() => {}} />)
    expect(screen.getByTestId("reveal-timer")).toBeInTheDocument()
    await waitFor(() => {
      const text = screen.getByTestId("reveal-timer").textContent || ""
      expect(text.startsWith("1") || text.startsWith("0")).toBe(true)
    }, { timeout: 3000 })
  })
  it("fires onExpire at 0", async () => {
    const onExpire = vi.fn()
    render(<RevealTimer active durationMs={500} onExpire={onExpire} />)
    await waitFor(() => expect(onExpire).toHaveBeenCalled(), { timeout: 2000 })
  })
  it("cleans up on unmount", () => {
    const onExpire = vi.fn()
    const { unmount } = render(<RevealTimer active durationMs={5000} onExpire={onExpire} />)
    unmount()
    expect(onExpire).not.toHaveBeenCalled()
  })
})
