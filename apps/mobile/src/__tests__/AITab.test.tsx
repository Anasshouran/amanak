/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import AIAssistant from "../../app/(tabs)/ai"

vi.mock("../../src/lib/api", () => ({
  api: {
    aiGuidance: vi.fn().mockResolvedValue({ text: "Guidance text", provider: "fake", model: "fake-model", tokens_used: 5 }),
    aiExplainScan: vi.fn().mockResolvedValue({ text: "Scan explanation", provider: "fake", model: "fake-model", tokens_used: 3 }),
  },
}))

describe("AITab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders disabled state", () => {
    render(<AIAssistant />)
    expect(screen.getByText(/disabled/i)).toBeTruthy()
  })

  it("shows input fields when enabled", async () => {
    const { api } = await import("../../src/lib/api")
    ;(api.aiGuidance as any).mockResolvedValue({ text: "OK", provider: "fake", model: "fake-model", tokens_used: 1 })
    render(<AIAssistant />)
    await waitFor(() => expect(screen.getByPlaceholderText(/Scan ID/i)).toBeTruthy())
  })
})
