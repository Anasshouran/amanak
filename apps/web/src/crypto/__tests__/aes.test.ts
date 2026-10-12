import { describe, expect, it } from "vitest"

import { aadFromEntryId, decrypt, encrypt } from "../aes"

const enc = new TextEncoder()
const dec = new TextDecoder()

async function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
}

describe("aes-gcm", () => {
  it("encrypt then decrypt returns the original plaintext", async () => {
    const key = await makeKey()
    const aad = aadFromEntryId(42)
    const { ciphertext, iv } = await encrypt(key, enc.encode("s3cr3t"), aad)
    const out = await decrypt(key, ciphertext, iv, aad)
    expect(dec.decode(out)).toBe("s3cr3t")
  })

  it("wrong key fails authentication", async () => {
    const [k1, k2] = await Promise.all([makeKey(), makeKey()])
    const aad = aadFromEntryId(7)
    const { ciphertext, iv } = await encrypt(k1, enc.encode("x"), aad)
    await expect(decrypt(k2, ciphertext, iv, aad)).rejects.toThrow()
  })

  it("tampered ciphertext fails authentication", async () => {
    const key = await makeKey()
    const aad = aadFromEntryId(7)
    const { ciphertext, iv } = await encrypt(key, enc.encode("x"), aad)
    ciphertext[0] ^= 0xff
    await expect(decrypt(key, ciphertext, iv, aad)).rejects.toThrow()
  })

  it("mismatched AAD (swapped entry id) fails authentication", async () => {
    const key = await makeKey()
    const { ciphertext, iv } = await encrypt(key, enc.encode("x"), aadFromEntryId(1))
    await expect(decrypt(key, ciphertext, iv, aadFromEntryId(2))).rejects.toThrow()
  })

  it("every encryption uses a fresh IV", async () => {
    const key = await makeKey()
    const aad = aadFromEntryId(1)
    const [r1, r2] = await Promise.all([
      encrypt(key, enc.encode("x"), aad),
      encrypt(key, enc.encode("x"), aad),
    ])
    expect(r1.iv).not.toEqual(r2.iv)
  })

  it("iv is 12 bytes and ciphertext carries the auth tag", async () => {
    const key = await makeKey()
    const { ciphertext, iv } = await encrypt(key, enc.encode("hello"), aadFromEntryId(1))
    expect(iv.length).toBe(12)
    expect(ciphertext.length).toBe("hello".length + 16) // GCM tag appended
  })
})