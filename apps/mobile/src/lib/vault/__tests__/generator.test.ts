import { describe, it, expect, vi } from "vitest"

// The generator only needs a byte source; mocking `./random` keeps expo-crypto
// (a React Native native module) out of the Node test environment.
vi.mock("../random", () => ({
  randomBytes: (size: number) => {
    const out = new Uint8Array(size)
    for (let i = 0; i < size; i++) out[i] = Math.floor(Math.random() * 256)
    return out
  },
}))

import {
  MAX_LENGTH,
  MIN_LENGTH,
  defaultGeneratorOptions,
  generatePassword,
} from "../generator"

describe("P9 mobile password generator", () => {
  it("generates a password of the requested length", () => {
    for (const length of [MIN_LENGTH, 20, MAX_LENGTH]) {
      const password = generatePassword({ ...defaultGeneratorOptions(), length })
      expect(password).toHaveLength(length)
    }
  })

  it("clamps the length to the supported bounds", () => {
    expect(generatePassword({ ...defaultGeneratorOptions(), length: 1 })).toHaveLength(MIN_LENGTH)
    expect(generatePassword({ ...defaultGeneratorOptions(), length: 999 })).toHaveLength(MAX_LENGTH)
  })

  it("includes at least one character from every selected set", () => {
    for (let i = 0; i < 50; i++) {
      const password = generatePassword({ ...defaultGeneratorOptions(), length: 16 })
      expect(password).toMatch(/[a-z]/)
      expect(password).toMatch(/[A-Z]/)
      expect(password).toMatch(/[0-9]/)
      expect(password).toMatch(/[^A-Za-z0-9]/)
    }
  })

  it("omits ambiguous characters when requested", () => {
    for (let i = 0; i < 50; i++) {
      const password = generatePassword({
        ...defaultGeneratorOptions(),
        length: 40,
        excludeAmbiguous: true,
      })
      expect(password).not.toMatch(/[0O1lI]/)
    }
  })

  it("honours a single selected set", () => {
    const password = generatePassword({
      length: 20,
      lower: false,
      upper: false,
      digits: true,
      symbols: false,
      excludeAmbiguous: false,
    })
    expect(password).toMatch(/^[0-9]+$/)
  })

  it("throws when no character set is selected", () => {
    expect(() =>
      generatePassword({
        length: 16,
        lower: false,
        upper: false,
        digits: false,
        symbols: false,
        excludeAmbiguous: false,
      }),
    ).toThrow()
  })

  it("produces different passwords across calls", () => {
    const a = generatePassword(defaultGeneratorOptions())
    const b = generatePassword(defaultGeneratorOptions())
    expect(a).not.toBe(b)
  })
})
