/**
 * Vault key handling for the mobile 2FA mirror (P8, server-blind).
 *
 * The master password is used only here, in memory. PBKDF2-SHA256 (OWASP 2023
 * minimum: 310,000 iterations) derives a 32-byte AES-256 key that is held in
 * React state for the session and never persisted or sent to the server.
 *
 * The primitives come from the audited @noble libraries (P8.1). The blob format
 * is unchanged: AES-256-GCM with a 12-byte IV and the entry id as 8-byte AAD,
 * with the 16-byte tag appended to the ciphertext — byte-identical to Web
 * Crypto on the web client. The random salt and IV are supplied by the caller
 * (see `./random`).
 */

import { gcm } from "@noble/ciphers/aes.js"
import { pbkdf2 } from "@noble/hashes/pbkdf2.js"
import { sha256 } from "@noble/hashes/sha2.js"

import { utf8Encode } from "./bytes"

export const PBKDF2_ITERATIONS = 310000
export const KEY_LENGTH = 32
export const IV_LENGTH = 12

export function deriveKeyBytes(
  masterPassword: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Uint8Array {
  return pbkdf2(sha256, utf8Encode(masterPassword), salt, { c: iterations, dkLen: KEY_LENGTH })
}

/** Encode the entry id as 8 big-endian bytes for use as AES-GCM AAD. */
export function aadFromEntryId(id: number): Uint8Array {
  const out = new Uint8Array(8)
  let value = Math.floor(id)
  for (let i = 7; i >= 0; i--) {
    out[i] = value % 256
    value = Math.floor(value / 256)
  }
  return out
}

/** AES-256-GCM encrypt; returns `ciphertext || tag` (WebCrypto-compatible). */
export function encryptWithIv(
  key: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
  iv: Uint8Array,
): Uint8Array {
  return gcm(key, iv, aad).encrypt(plaintext)
}

/** AES-256-GCM decrypt; throws when authentication fails. */
export function decryptWithIv(
  key: Uint8Array,
  ciphertext: Uint8Array,
  iv: Uint8Array,
  aad: Uint8Array,
): Uint8Array {
  return gcm(key, iv, aad).decrypt(ciphertext)
}