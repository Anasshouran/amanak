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
    await Promise.resolve()
  })
}

describe("AITab", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })

  it("renders disabled state when AI off", async () => {
    const { api } = await import("../lib/api")
    ;(api.aiGuidance as any).mockRejectedValue({ code: "ai_disabled" })
    const rendered = render(<AIAssistant />)
    await flush()
    await act(async () => {
      const btn = rendered.container.querySelectorAll('div[role="button"], button, [tabindex]')
      for (let i = 0; i < btn.length; i++) {
        const el = btn[i] as any
        if ((el.textContent || '').includes('Get guidance')) {
          if (typeof el.click === 'function') el.click()
          break
        }
      }
    })
    await flush()
    const text = rendered.text()
    expect(text).toMatch(/AI is disabled|disabled|unavailable/i)
    if (typeof rendered.unmount === 'function') rendered.unmount()
  })

  it("shows input when AI enabled (mock)", async () => {
    const { api } = await import("../lib/api")
    ;(api.aiGuidance as any).mockResolvedValue({ text: "OK", provider: "fake", model: "fake-model", tokens_used: 1 })
    const rendered = render(<AIAssistant />)
    await flush()
    expect(rendered.text()).toContain("Safety guidance")
    if (typeof rendered.unmount === 'function') rendered.unmount()
  })
})
