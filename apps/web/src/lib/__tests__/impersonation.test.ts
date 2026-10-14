import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  clearImpersonation,
  getImpersonation,
  impersonationHeader,
  remainingSeconds,
  setImpersonation,
  subscribeImpersonation,
} from "../impersonation"

describe("impersonation session", () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it("returns null when no session is stored", () => {
    expect(getImpersonation()).toBeNull()
    expect(impersonationHeader()).toBeNull()
  })

  it("round-trips a stored session", () => {
    setImpersonation({
      userId: 42,
      email: "target@example.com",
      sessionId: 7,
      expiresAt: Date.now() + 60_000,
    })
    const stored = getImpersonation()
    expect(stored?.userId).toBe(42)
    expect(stored?.email).toBe("target@example.com")
    expect(impersonationHeader()).toEqual({ userId: 42 })
  })

  it("clears the session", () => {
    setImpersonation({
      userId: 1,
      email: "a@example.com",
      sessionId: 1,
      expiresAt: Date.now() + 60_000,
    })
    clearImpersonation()
    expect(getImpersonation()).toBeNull()
  })

  it("treats an expired session as absent", () => {
    setImpersonation({
      userId: 1,
      email: "a@example.com",
      sessionId: 1,
      expiresAt: Date.now() - 1,
    })
    expect(getImpersonation()).toBeNull()
  })

  it("computes remaining seconds and notifies subscribers", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeImpersonation(listener)
    setImpersonation({
      userId: 1,
      email: "a@example.com",
      sessionId: 1,
      expiresAt: Date.now() + 30_000,
    })
    expect(listener).toHaveBeenCalled()
    const stored = getImpersonation()!
    expect(remainingSeconds(stored, stored.expiresAt - 10_000)).toBe(10)
    unsubscribe()
  })
})
