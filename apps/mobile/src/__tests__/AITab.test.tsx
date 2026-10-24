/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react-dom/test-utils"

vi.mock("../lib/api", () => ({
  api: {
    aiGuidance: vi.fn(),
    aiExplainScan: vi.fn(),
  },
}))

import { render } from "../test/render"
import AIAssistant from "../../app/(tabs)/ai"

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe("AITab", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { api } = await import("../lib/api")
    ;(api.aiGuidance as any).mockResolvedValue({ text: "Guidance text", provider: "fake", model: "fake-model", tokens_used: 5 })
    ;(api.aiExplainScan as any).mockResolvedValue({ text: "Scan explanation", provider: "fake", model: "fake-model", tokens_used: 3 })
  })

  it("renders disabled state when AI off", async () => {
    const rendered = render(<AIAssistant />)
    await flush()
    expect(rendered.text()).toContain("AI is disabled by configuration.")
    rendered.unmount()
  })

  it("shows input when AI enabled (mock)", async () => {
    const { api } = await import("../lib/api")
    ;(api.aiGuidance as any).mockResolvedValue({ text: "OK", provider: "fake", model: "fake-model", tokens_used: 1 })
    const rendered = render(<AIAssistant />)
    await flush()
    expect(rendered.text()).toContain("Safety guidance")
    rendered.unmount()
  })
})
