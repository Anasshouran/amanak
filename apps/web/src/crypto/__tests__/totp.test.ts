import { describe, expect, it } from "vitest"

import { generateTotp } from "../totp"

const enc = new TextEncoder()

/**
 * RFC 6238 Appendix B test vectors, SHA-1 row, truncated to 6 digits.
 * Secret: ASCII "12345678901234567890" (20 bytes).
 */
const VECTORS: Array<[seconds: number, expected: string]> = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"],
]

describe("totp (RFC 6238)", () => {
  const secret = enc.encode("12345678901234567890")

  for (const [seconds, expected] of VECTORS) {
    it(`produces ${expected} at T=${seconds}`, async () => {
      expect(await generateTotp(secret, seconds * 1000)).toBe(expected)
    })
  }

  it("emits exactly 6 digits", async () => {
    const code = await generateTotp(secret, 59 * 1000)
    expect(code).toMatch(/^\d{6}$/)
  })

  it("changes across the 30-second window boundary", async () => {
    const [a, b] = await Promise.all([
      generateTotp(secret, 59 * 1000),
      generateTotp(secret, 61 * 1000),
    ])
    expect(a).not.toBe(b)
  })

  it("stays constant within the same 30-second step", async () => {
    const [a, b] = await Promise.all([
      generateTotp(secret, 60 * 1000),
      generateTotp(secret, 60_030),
    ])
    expect(a).toBe(b)
  })
})