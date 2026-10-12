import { describe, expect, it } from "vitest"

import { toBytes } from "../bytes"
import { deriveKey } from "../kdf"

const SALT = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32])
const IV = crypto.getRandomValues(new Uint8Array(12))
const PLAIN = new TextEncoder().encode("hello")

async function canDecryptWith(key: CryptoKey, ciphertext: Uint8Array): Promise<boolean> {
  try {
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toBytes(IV) },
      key,
      toBytes(ciphertext),
    )
    return true
  } catch {
    return false
  }
}

async function sealWith(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toBytes(IV) },
      key,
      toBytes(PLAIN),
    ),
  )
}

describe("kdf (PBKDF2-SHA256)", () => {
  it("same password + salt + iterations derive the same key deterministically", async () => {
    const [k1, k2] = await Promise.all([
      deriveKey("correct horse battery staple", SALT, 310_000),
      deriveKey("correct horse battery staple", SALT, 310_000),
    ])
    const sealed = await sealWith(k1)
    await expect(canDecryptWith(k2, sealed)).resolves.toBe(true)
  })

  it("a different password derives a different key", async () => {
    const [k1, k2] = await Promise.all([
      deriveKey("correct horse battery staple", SALT, 310_000),
      deriveKey("wrong horse battery staple", SALT, 310_000),
    ])
    const sealed = await sealWith(k1)
    await expect(canDecryptWith(k2, sealed)).resolves.toBe(false)
  })

  it("a different salt derives a different key", async () => {
    const otherSalt = Uint8Array.from(SALT).map((b, i) => (i === 0 ? b ^ 0xff : b))
    const [k1, k2] = await Promise.all([
      deriveKey("correct horse battery staple", SALT, 310_000),
      deriveKey("correct horse battery staple", otherSalt, 310_000),
    ])
    const sealed = await sealWith(k1)
    await expect(canDecryptWith(k2, sealed)).resolves.toBe(false)
  })

  it("different iteration counts derive different keys", async () => {
    const [k1, k2] = await Promise.all([
      deriveKey("correct horse battery staple", SALT, 310_000),
      deriveKey("correct horse battery staple", SALT, 310_001),
    ])
    const sealed = await sealWith(k1)
    await expect(canDecryptWith(k2, sealed)).resolves.toBe(false)
  })

  it("produces a non-extractable key", async () => {
    const key = await deriveKey("correct horse battery staple", SALT, 310_000)
    await expect(crypto.subtle.exportKey("raw", key)).rejects.toThrow()
  })
})