/**
 * Encrypted password-payload helpers for the mobile mirror (P9, server-blind).
 *
 * The server only ever sees the opaque `ciphertext || tag` blob and the 12-byte
 * IV. This module turns the plaintext payload (password, notes, custom fields)
 * into that blob and back. The entry's server-side id is passed as AES-GCM
 * additional authenticated data so a blob cannot be replayed under another
 * entry. The format is JSON UTF-8, byte-identical to the web client.
 */

import { utf8Decode, utf8Encode } from "./bytes"
import { decryptWithIv, encryptWithIv } from "./vault"

export type CustomField = {
  name: string
  value: string
  sensitive: boolean
}

export type PasswordPayload = {
  password: string
  notes: string
  customFields: CustomField[]
}

export function emptyPayload(): PasswordPayload {
  return { password: "", notes: "", customFields: [] }
}

function normalizeCustomFields(value: unknown): CustomField[] {
  if (!Array.isArray(value)) return []
  const out: CustomField[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue
    const row = entry as Record<string, unknown>
    out.push({
      name: typeof row.name === "string" ? row.name : "",
      value: typeof row.value === "string" ? row.value : "",
      sensitive: row.sensitive === true,
    })
  }
  return out
}

export function serializePayload(payload: PasswordPayload): Uint8Array {
  const normalized: PasswordPayload = {
    password: payload.password ?? "",
    notes: payload.notes ?? "",
    customFields: normalizeCustomFields(payload.customFields),
  }
  return utf8Encode(JSON.stringify(normalized))
}

export function parsePayload(bytes: Uint8Array): PasswordPayload {
  const parsed = JSON.parse(utf8Decode(bytes)) as Record<string, unknown>
  return {
    password: typeof parsed.password === "string" ? parsed.password : "",
    notes: typeof parsed.notes === "string" ? parsed.notes : "",
    customFields: normalizeCustomFields(parsed.customFields),
  }
}

export function encryptPayload(
  key: Uint8Array,
  payload: PasswordPayload,
  aad: Uint8Array,
  iv: Uint8Array,
): Uint8Array {
  return encryptWithIv(key, serializePayload(payload), aad, iv)
}

export function decryptPayload(
  key: Uint8Array,
  ciphertext: Uint8Array,
  iv: Uint8Array,
  aad: Uint8Array,
): PasswordPayload {
  return parsePayload(decryptWithIv(key, ciphertext, iv, aad))
}
