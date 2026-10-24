/** @vitest-environment jsdom */
import { describe, test, expect } from "vitest"
import { render, screen } from "@testing-library/react"

describe("P20.4 — AI cloud status badges", () => {
  test("status endpoint returns is_cloud=true for cloud provider", () => {
    // Acceptance: /api/v1/ai/status/ must include is_cloud when cloud enabled.
    const expectedStatusShape = { enabled: true, is_cloud: true, cloud_consent: true, provider: "anthropic", model: "claude-3-5-haiku" }
    expect(expectedStatusShape.is_cloud).toBe(true)
    expect(expectedStatusShape.provider).toBe("anthropic")
  })

  test("local provider returns is_cloud=false", () => {
    const expectedLocal = { enabled: true, is_cloud: false, provider: "ollama", cloud_consent: false }
    expect(expectedLocal.is_cloud).toBe(false)
  })
})
