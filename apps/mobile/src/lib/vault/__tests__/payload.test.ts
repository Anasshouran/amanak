import { describe, it, expect } from "vitest"
import { createDecipheriv } from "node:crypto"

import { utf8Encode } from "../bytes"
import { aadFromEntryId } from "../vault"
import {
  decryptPayload,
  encryptPayload,
  parsePayload,
  serializePayload,
  type PasswordPayload,
} from "../passwordPayload"

const KEY = Uint8Array.from({ length: 32 }, (_, i) => i)
const IV = Uint8Array.of(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11)

const PAYLOAD: PasswordPayload = {
  password: "S3cr3t-كلمة-مرور",
  notes: "multi\nline مرحبا ٢٠٢٦",
  customFields: [
    { name: "PIN", value: "1234", sensitive: true },
    { name: "Recovery", value: "abc", sensitive: false },
  ],
}

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex")
}

function nodeDecrypt(key: Uint8Array, iv: Uint8Array, aad: Uint8Array, blob: Uint8Array): Uint8Array {
  const tag = blob.subarray(blob.length - 16)
  const ciphertext = blob.subarray(0, blob.length - 16)
  const decipher = createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAAD(aad)
  decipher.setAuthTag(tag)
  return new Uint8Array(Buffer.concat([decipher.update(ciphertext), decipher.final()]))
}

describe("P9 password payload", () => {
  it("serializes to stable JSON with normalized custom fields", () => {
    const bytes = serializePayload({
      password: "pw",
      notes: "",
      customFields: [{ name: "n", value: "v", sensitive: true }],
    })
    expect(hex(bytes)).toBe(
      hex(
        utf8Encode(
          '{"password":"pw","notes":"","customFields":[{"name":"n","value":"v","sensitive":true}]}',
        ),
      ),
    )
  })

  it("tolerates a partial payload when parsing", () => {
    const parsed = parsePayload(utf8Encode('{"password":"only"}'))
    expect(parsed.password).toBe("only")
    expect(parsed.notes).toBe("")
    expect(parsed.customFields).toEqual([])
  })

  it("round-trips through AES-256-GCM with the entry id as AAD", () => {
    const aad = aadFromEntryId(42)
    const blob = encryptPayload(KEY, PAYLOAD, aad, IV)
    const back = decryptPayload(KEY, blob, IV, aad)
    expect(back).toEqual(PAYLOAD)
  })

  it("is byte-for-byte decryptable by node:crypto (server-blind interop)", () => {
    const aad = aadFromEntryId(7)
    const blob = encryptPayload(KEY, PAYLOAD, aad, IV)
    expect(hex(nodeDecrypt(KEY, IV, aad, blob))).toBe(hex(serializePayload(PAYLOAD)))
  })

  it("rejects a blob bound to a different entry id", () => {
    const blob = encryptPayload(KEY, PAYLOAD, aadFromEntryId(1), IV)
    expect(() => decryptPayload(KEY, blob, IV, aadFromEntryId(2))).toThrow()
  })
})
