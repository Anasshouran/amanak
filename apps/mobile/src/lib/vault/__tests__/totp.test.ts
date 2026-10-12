import { describe, it, expect } from "vitest"

import { decode, encode } from "../base32"
import { generateTotp, totpSecondsRemaining } from "../totp"

describe("base32", () => {
  it("matches RFC 4648 vectors", () => {
    expect(encode(new Uint8Array([]))).toBe("")
    expect(encode(new Uint8Array([0x66]))).toBe("MY======")
    expect(encode(new Uint8Array([0x66, 0x6f]))).toBe("MZXQ====")
    expect(encode(new Uint8Array([0x66, 0x6f, 0x6f]))).toBe("MZXW6===")
    expect(encode(new Uint8Array([0x66, 0x6f, 0x6f, 0x62]))).toBe("MZXW6YQ=")
    expect(encode(new Uint8Array([0x66, 0x6f, 0x6f, 0x62, 0x61]))).toBe("MZXW6YTB")
    expect(encode(new Uint8Array([0x66, 0x6f, 0x6f, 0x62, 0x61, 0x72]))).toBe("MZXW6YTBOI======")
  })

  it("decodes case-insensitively and ignores padding/whitespace/dashes", () => {
    expect(Array.from(decode("mzxw6ytboi======"))).toEqual([0x66, 0x6f, 0x6f, 0x62, 0x61, 0x72])
    expect(Array.from(decode("MZXW6YTB"))).toEqual([0x66, 0x6f, 0x6f, 0x62, 0x61])
    expect(Array.from(decode("jbsw-y3dp ehpk3pxp"))).toEqual(
      Array.from(decode("JBSWY3DPEHPK3PXP")),
    )
  })

  it("rejects invalid characters", () => {
    expect(() => decode("MZXW6YTB!")).toThrow(/Invalid base32/)
    expect(() => decode("0189")).toThrow(/Invalid base32/)
  })
})

describe("TOTP (RFC 6238, SHA-1, 6 digits)", () => {
  const secret = new TextEncoder().encode("12345678901234567890")

  it("matches the RFC 6238 appendix B vectors", () => {
    expect(generateTotp(secret, 59 * 1000)).toBe("287082")
    expect(generateTotp(secret, 1111111109 * 1000)).toBe("081804")
    expect(generateTotp(secret, 1111111111 * 1000)).toBe("050471")
    expect(generateTotp(secret, 1234567890 * 1000)).toBe("005924")
    expect(generateTotp(secret, 2000000000 * 1000)).toBe("279037")
    expect(generateTotp(secret, 20000000000 * 1000)).toBe("353130")
  })

  it("always returns six digits", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateTotp(secret, i * 7000)).toMatch(/^\d{6}$/)
    }
  })

  it("stays constant within a step and changes across the boundary", () => {
    expect(generateTotp(secret, 60 * 1000)).toBe(generateTotp(secret, 60300))
    expect(generateTotp(secret, 59000)).not.toBe(generateTotp(secret, 61000))
  })

  it("works with a real base32 secret", () => {
    const bytes = decode("JBSWY3DPEHPK3PXP")
    expect(bytes.length).toBe(10)
    expect(generateTotp(bytes, 0)).toMatch(/^\d{6}$/)
  })

  it("reports seconds remaining in the current step", () => {
    expect(totpSecondsRemaining(0)).toBe(30)
    expect(totpSecondsRemaining(1000)).toBe(29)
    expect(totpSecondsRemaining(29000)).toBe(1)
  })
})