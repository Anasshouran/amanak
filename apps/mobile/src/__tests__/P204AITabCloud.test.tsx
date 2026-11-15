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
import AIAssistant from "../../src/app/(tabs)/ai"

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe("P20.4 — AI hybrid cloud consent", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { api } = await import("../lib/api")
    ;(api.aiGuidance as any).mockResolvedValue({ text: "OK", provider: "fake", model: "fake-model", tokens_used: 1 })
  })

  it("component renders AI enabled state", async () => {
    const rendered = render(<AIAssistant />)
    await flush()
    expect(rendered.text()).toContain("Safety guidance")
    if (typeof rendered.unmount === "function") rendered.unmount()
  })
})
