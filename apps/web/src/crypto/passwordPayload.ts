/**
 * Encrypted password-payload helpers (P9, server-blind).
 *
 * The server only ever sees the opaque `ciphertext || tag` blob and the 12-byte
 * IV. This module turns the plaintext payload (password, notes, custom fields)
 * into that blob and back. The entry's server-side id is passed as AES-GCM
 * additional authenticated data so a blob cannot be replayed under another
 * entry.
 */

import { decrypt, encrypt, type AesGcmResult } from "./aes"

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

export type EncryptedPayload = AesGcmResult

export function emptyPayload(): PasswordPayload {
  return { password: "", notes: "", customFields: [] }
}

function normalizeCustomFields(value: unknown): CustomField[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      name: typeof entry.name === "string" ? entry.name : "",
      value: typeof entry.value === "string" ? entry.value : "",
      sensitive: entry.sensitive === true,
    }))
}

/** Serialize the payload to UTF-8 JSON bytes (stable key order). */
export function serializePayload(payload: PasswordPayload): Uint8Array {
  const normalized: PasswordPayload = {
    password: payload.password ?? "",
    notes: payload.notes ?? "",
    customFields: normalizeCustomFields(payload.customFields),
  }
  return new TextEncoder().encode(JSON.stringify(normalized))
}

/** Parse decrypted bytes back into a payload, tolerating older/partial blobs. */
export function parsePayload(bytes: Uint8Array): PasswordPayload {
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
  return {
    password: typeof parsed.password === "string" ? parsed.password : "",
    notes: typeof parsed.notes === "string" ? parsed.notes : "",
    customFields: normalizeCustomFields(parsed.customFields),
  }
}

export async function encryptPayload(
  key: CryptoKey,
  payload: PasswordPayload,
  aad: Uint8Array,
): Promise<EncryptedPayload> {
  return encrypt(key, serializePayload(payload), aad)
}

export async function decryptPayload(
  key: CryptoKey,
  ciphertext: Uint8Array,
  iv: Uint8Array,
  aad: Uint8Array,
): Promise<PasswordPayload> {
  return parsePayload(await decrypt(key, ciphertext, iv, aad))
}
