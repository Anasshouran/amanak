import { describe, expect, it } from "vitest"

import { scorePassword, strengthLabel } from "../strength"

describe("password strength", () => {
  it("scores an empty password zero", () => {
    expect(scorePassword("")).toBe(0)
  })

  it("scores a longer, varied password higher than a short, simple one", () => {
    expect(scorePassword("aaaaaaaa")).toBeLessThan(scorePassword("Tr0ub4dor&3xK!pQ"))
  })

  it("always returns a value in 0..100", () => {
    for (const pw of ["", "a", "password", "correct horse battery staple", "!".repeat(100)]) {
      const score = scorePassword(pw)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  })

  it("penalizes common passwords and sequences", () => {
    expect(scorePassword("password123")).toBeLessThan(scorePassword("Xk9!vQm2#Lp7"))
    expect(scorePassword("abcdefghij")).toBeLessThan(scorePassword("Xk9!vQm2#Lp"))
  })

  it("maps scores to labels monotonically", () => {
    expect(strengthLabel(0)).toBe("weak")
    expect(strengthLabel(50)).toBe("fair")
    expect(strengthLabel(70)).toBe("good")
    expect(strengthLabel(95)).toBe("strong")
  })
})
