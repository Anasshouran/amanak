import { describe, expect, it } from "vitest"

import { deriveKey } from "../kdf"
import {
  VERIFICATION_PLAINTEXT,
  createVerification,
  verifyKey,
} from "../verification"

async function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
}

describe("vault verification blob", () => {
  it("round-trips with the same key and rejects a different key", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ])
    const other = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ])
    const { iv, ciphertext } = await createVerification(key)
    expect(await verifyKey(key, iv, ciphertext)).toBe(true)
    expect(await verifyKey(other, iv, ciphertext)).toBe(false)
  })

  it("uses a 12-byte IV and appends the 16-byte GCM tag", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ])
    const plaintextLength = new TextEncoder().encode(VERIFICATION_PLAINTEXT).length
    const { iv, ciphertext } = await createVerification(key)
    expect(iv.length).toBe(12)
    expect(ciphertext.length).toBe(plaintextLength + 16)
  })

  it("rejects a tampered blob", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ])
    const { iv, ciphertext } = await createVerification(key)
    ciphertext[0] ^= 0xff
    expect(await verifyKey(key, iv, ciphertext)).toBe(false)
  })

  it("rejects a wrong master password on an empty vault", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(32))
    const setupKey = await deriveKey("correct-horse-battery", salt, 1000)
    const { iv, ciphertext } = await createVerification(setupKey)

    const wrongKey = await deriveKey("wrong-horse-battery", salt, 1000)
    expect(await verifyKey(wrongKey, iv, ciphertext)).toBe(false)
  })

  it("accepts the correct master password on an empty vault", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(32))
    const key = await deriveKey("correct-horse-battery", salt, 1000)
    const { iv, ciphertext } = await createVerification(key)

    const again = await deriveKey("correct-horse-battery", salt, 1000)
    expect(await verifyKey(again, iv, ciphertext)).toBe(true)
  })
})
