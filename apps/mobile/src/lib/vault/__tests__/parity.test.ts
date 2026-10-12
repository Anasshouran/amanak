import { describe, it, expect } from "vitest"
import { createCipheriv, createDecipheriv } from "node:crypto"

import { utf8Decode, utf8Encode } from "../bytes"
import { decryptWithIv, encryptWithIv } from "../vault"

/**
 * P8.1 parity freeze.
 *
 * A single fixed vector (key, iv, aad, plaintext) is encrypted with the
 * production mobile path (`encryptWithIv`, now backed by @noble). The expected
 * `ciphertext || tag` was produced once with Node's `node:crypto`
 * (`aes-256-gcm`) and is hardcoded here. If the mobile blob ever stops matching
 * this value, web/mobile interoperability has regressed.
 */

const KEY = Uint8Array.from({ length: 32 }, (_, i) => i)
const IV = Uint8Array.of(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)
const AAD = utf8Encode("amanak-p8-parity")
// ASCII + Arabic so the vector also asserts UTF-8 preservation end to end.
const PLAINTEXT = utf8Encode("JBSWY3DPEHPK3PXP مرحبا ٢٠٢٦")

// Generated once with: createCipheriv("aes-256-gcm", KEY, IV) + setAAD(AAD).
const EXPECTED_BLOB_HEX =
  "0d40854c9cd6864bc809c7c082b9203da30f02ec41a3f2a490bf42a5c4cbd912d8b2775a512f21ead28f29e0948d81303f9d9a85"

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex")
}

function nodeEncrypt(key: Uint8Array, iv: Uint8Array, aad: Uint8Array, plaintext: Uint8Array): Uint8Array {
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  cipher.setAAD(aad)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return new Uint8Array(Buffer.concat([ciphertext, cipher.getAuthTag()]))
}

function nodeDecrypt(key: Uint8Array, iv: Uint8Array, aad: Uint8Array, blob: Uint8Array): Uint8Array {
  const tag = blob.subarray(blob.length - 16)
  const ciphertext = blob.subarray(0, blob.length - 16)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAAD(aad)
  decipher.setAuthTag(tag)
  return new Uint8Array(Buffer.concat([decipher.update(ciphertext), decipher.final()]))
}

describe("P8.1 mobile/web AES-256-GCM parity", () => {
  it("mobile encrypt matches the frozen node:crypto vector", () => {
    const blob = encryptWithIv(KEY, PLAINTEXT, AAD, IV)
    expect(hex(blob)).toBe(EXPECTED_BLOB_HEX)
  })

  it("mobile decrypts the frozen node:crypto ciphertext back to UTF-8", () => {
    const blob = new Uint8Array(Buffer.from(EXPECTED_BLOB_HEX, "hex"))
    expect(utf8Decode(decryptWithIv(KEY, blob, IV, AAD))).toBe(utf8Decode(PLAINTEXT))
  })

  it("mobile decrypt of node:crypto ciphertext round-trips", () => {
    const theirs = nodeEncrypt(KEY, IV, AAD, PLAINTEXT)
    expect(utf8Decode(decryptWithIv(KEY, theirs, IV, AAD))).toBe(utf8Decode(PLAINTEXT))
  })

  it("node:crypto decrypt of the mobile ciphertext round-trips", () => {
    const ours = encryptWithIv(KEY, PLAINTEXT, AAD, IV)
    expect(utf8Decode(nodeDecrypt(KEY, IV, AAD, ours))).toBe(utf8Decode(PLAINTEXT))
  })
})
