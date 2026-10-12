import { toBytes } from "./bytes"

/**
 * AES-256-GCM (P8). Every encryption uses a fresh 12-byte IV and the caller
 * must pass the entry's server-side id as additional authenticated data so
 * ciphertext cannot be swapped between entries.
 */

export type AesGcmResult = {
  ciphertext: Uint8Array
  iv: Uint8Array
}

export async function encrypt(
  key: CryptoKey,
  plaintext: Uint8Array,
  aad: Uint8Array,
): Promise<AesGcmResult> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: toBytes(iv), additionalData: toBytes(aad) },
      key,
      toBytes(plaintext),
    ),
  )
  return { ciphertext, iv }
}

export async function decrypt(
  key: CryptoKey,
  ciphertext: Uint8Array,
  iv: Uint8Array,
  aad: Uint8Array,
): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toBytes(iv), additionalData: toBytes(aad) },
    key,
    toBytes(ciphertext),
  )
  return new Uint8Array(plaintext)
}

/** Encode the entry id as bytes for use as AES-GCM AAD. */
export function aadFromEntryId(id: number): Uint8Array {
  const out = new Uint8Array(8)
  let value = Math.floor(id)
  for (let i = 7; i >= 0; i--) {
    out[i] = value % 256
    value = Math.floor(value / 256)
  }
  return out
}