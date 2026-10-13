import { describe, expect, it } from "vitest"

import {
  MAX_LENGTH,
  MIN_LENGTH,
  defaultGeneratorOptions,
  generatePassword,
} from "../generator"

const sets = {
  lower: /[a-z]/,
  upper: /[A-Z]/,
  digits: /\d/,
  symbols: /[^A-Za-z0-9]/,
}

describe("password generator", () => {
  it("honours the requested length within bounds", () => {
    for (const length of [12, 20, 40, 64, 2, 999]) {
      const out = generatePassword({ ...defaultGeneratorOptions(), length })
      expect(out.length).toBeGreaterThanOrEqual(12)
      expect(out.length).toBeLessThanOrEqual(64)
    }
  })

  it("includes a character from every selected set", () => {
    for (let i = 0; i < 50; i++) {
      const out = generatePassword({
        length: 16,
        lower: true,
        upper: true,
        digits: true,
        symbols: true,
        excludeAmbiguous: true,
      })
      expect(/[a-z]/.test(out)).toBe(true)
      expect(/[A-Z]/.test(out)).toBe(true)
      expect(/\d/.test(out)).toBe(true)
      expect(/[^A-Za-z0-9]/.test(out)).toBe(true)
    }
  })

  it("honours a limited character set", () => {
    const out = generatePassword({
      length: 24,
      lower: false,
      upper: false,
      digits: true,
      symbols: false,
      excludeAmbiguous: false,
    })
    expect(/^[0-9]+$/.test(out)).toBe(true)
  })

  it("excludes ambiguous characters when asked", () => {
    for (let i = 0; i < 50; i++) {
      const out = generatePassword({
        length: 40,
        lower: true,
        upper: true,
        digits: true,
        symbols: false,
        excludeAmbiguous: true,
      })
      expect(out).not.toMatch(/[0O1lI]/)
    }
  })

  it("produces different values on each call", () => {
    const opts = {
      length: 32,
      lower: true,
      upper: true,
      digits: true,
      symbols: true,
      excludeAmbiguous: false,
    }
    const values = new Set(Array.from({ length: 20 }, () => generatePassword(opts)))
    expect(values.size).toBe(20)
  })

  it("throws when no character set is selected", () => {
    expect(() =>
      generatePassword({
        length: 20,
        lower: false,
        upper: false,
        digits: false,
        symbols: false,
        excludeAmbiguous: false,
      }),
    ).toThrow()
  })
})
