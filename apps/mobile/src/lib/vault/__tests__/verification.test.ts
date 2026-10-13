import { describe, it, expect } from "vitest"

import { utf8Encode } from "../bytes"
import { deriveKeyBytes } from "../vault"
import { VERIFICATION_PLAINTEXT, createVerification, verifyKey } from "../verification"

const KEY = new Uint8Array(32).fill(7)
const OTHER_KEY = new Uint8Array(32).fill(9)
const IV = new Uint8Array(12).fill(3)

describe("P9.1 mobile verification blob", () => {
  it("round-trips with the same key", () => {
    const { iv, ciphertext } = createVerification(KEY, IV)
    expect(iv.length).toBe(12)
    expect(ciphertext.length).toBe(utf8Encode(VERIFICATION_PLAINTEXT).length + 16)
    expect(verifyKey(KEY, iv, ciphertext)).toBe(true)
  })

  it("rejects a different key", () => {
    const { iv, ciphertext } = createVerification(KEY, IV)
    expect(verifyKey(OTHER_KEY, iv, ciphertext)).toBe(false)
  })

  it("rejects a tampered blob", () => {
    const { iv, ciphertext } = createVerification(KEY, IV)
    ciphertext[0] ^= 0xff
    expect(verifyKey(KEY, iv, ciphertext)).toBe(false)
  })

  it("rejects a wrong master password on an empty vault", () => {
    const salt = new Uint8Array(32).fill(1)
    const setupKey = deriveKeyBytes("correct-horse-battery", salt, 1000)
    const { iv, ciphertext } = createVerification(setupKey, IV)

    const wrongKey = deriveKeyBytes("wrong-horse-battery", salt, 1000)
    expect(verifyKey(wrongKey, iv, ciphertext)).toBe(false)

    const correctKey = deriveKeyBytes("correct-horse-battery", salt, 1000)
    expect(verifyKey(correctKey, iv, ciphertext)).toBe(true)
  })
})
