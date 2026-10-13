import { describe, expect, it } from "vitest"

import { aadFromEntryId, decrypt, encrypt } from "../aes"
import {
  decryptPayload,
  encryptPayload,
  parsePayload,
  serializePayload,
  type PasswordPayload,
} from "../passwordPayload"

async function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
}

const SAMPLE = {
  password: "S3cr3t-\u00e9\u0645",
  notes: "first line\nسطر ثانٍ",
  customFields: [
    { name: "PIN", value: "1234", sensitive: true },
    { name: "recovery", value: "abc", sensitive: false },
  ],
}

describe("password payload", () => {
  it("round-trips through encrypt/decrypt with the entry id as AAD", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ])
    const aad = aadFromEntryId(42)
    const { ciphertext, iv } = await encryptPayload(key, { password: "p", notes: "n", customFields: [] }, aad)
    const out = await decryptPayload(key, ciphertext, iv, aad)
    expect(out).toEqual({ password: "p", notes: "n", customFields: [] })
  })

  it("round-trips UTF-8 (Arabic) payloads", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ])
    const payload = {
      password: "كلمة-المرور-س",
      notes: "ملاحظات مهمة",
      customFields: [{ name: "سؤال", value: "الجواب", sensitive: true }],
    }
    const aad = aadFromEntryId(3)
    const { ciphertext, iv } = await encryptPayload(key, payload, aad)
    expect(await decryptPayload(key, ciphertext, iv, aad)).toEqual(payload)
  })

  it("binds the payload to the entry id (AAD)", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ])
    const { ciphertext, iv } = await encryptPayload(
      key,
      { password: "p", notes: "", customFields: [] },
      aadFromEntryId(1),
    )
    await expect(decryptPayload(key, ciphertext, iv, aadFromEntryId(2))).rejects.toThrow()
  })

  it("fails authentication on a tampered blob", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ])
    const aad = aadFromEntryId(5)
    const { ciphertext, iv } = await encryptPayload(key, { password: "x", notes: "", customFields: [] }, aad)
    ciphertext[0] ^= 0xff
    await expect(decryptPayload(key, ciphertext, iv, aad)).rejects.toThrow()
  })

  it("adds the GCM tag and uses a 12-byte IV", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ])
    const aad = aadFromEntryId(1)
    const plaintextLength = new TextEncoder().encode(
      JSON.stringify({ password: "", notes: "", customFields: [] }),
    ).length
    const { ciphertext, iv } = await encryptPayload(key, { password: "", notes: "", customFields: [] }, aad)
    expect(iv.length).toBe(12)
    expect(ciphertext.length).toBe(plaintextLength + 16)
  })

  it("normalizes malformed custom fields when parsing", () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ password: 1, customFields: [{ name: "a" }, null, "x"] }),
    )
    expect(parsePayload(bytes)).toEqual({
      password: "",
      notes: "",
      customFields: [{ name: "a", value: "", sensitive: false }],
    })
  })

  it("serialize/parse is a round-trip", () => {
    const payload = { password: "p", notes: "n", customFields: [{ name: "a", value: "b", sensitive: true }] }
    expect(parsePayload(serializePayload(payload))).toEqual(payload)
  })

  it("does not leak the plaintext into the ciphertext", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"])
    const secret = "sup3r-s3cret-value"
    const { ciphertext } = await encryptPayload(
      key,
      { password: secret, notes: "", customFields: [] },
      aadFromEntryId(1),
    )
    expect(new TextDecoder().decode(ciphertext)).not.toContain(secret)
  })

  it("decrypts a blob produced by the low-level aes module (format parity)", async () => {
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
      "encrypt",
      "decrypt",
    ])
    const raw = serializePayload({ password: "x", notes: "y", customFields: [] })
    const aad = aadFromEntryId(5)
    const { ciphertext, iv } = await encrypt(key, raw, aad)
    expect(await decryptPayload(key, ciphertext, iv, aad)).toEqual({
      password: "x",
      notes: "y",
      customFields: [],
    })
  })
})
