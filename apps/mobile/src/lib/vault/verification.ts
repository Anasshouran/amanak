/**
 * Vault verification blob (P9.1, mobile mirror).
 *
 * Setup encrypts a fixed, public plaintext with the derived key (empty AAD) and
 * stores the blob on the profile. Unlock decrypts it first, so a wrong master
 * password is rejected even when the vault has no entries. The plaintext is not
 * a secret; the IV is supplied by the caller (see `./random`).
 */

import { utf8Decode, utf8Encode } from "./bytes"
import { decryptWithIv, encryptWithIv } from "./vault"

export const VERIFICATION_PLAINTEXT = "AMANAK-PWD-VAULT-V1"

const EMPTY_AAD = new Uint8Array(0)

export function createVerification(
  key: Uint8Array,
  iv: Uint8Array,
): { iv: Uint8Array; ciphertext: Uint8Array } {
  const ciphertext = encryptWithIv(key, utf8Encode(VERIFICATION_PLAINTEXT), EMPTY_AAD, iv)
  return { iv, ciphertext }
}

/** True when `key` decrypts the blob back to the fixed plaintext. */
export function verifyKey(key: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array): boolean {
  try {
    return utf8Decode(decryptWithIv(key, ciphertext, iv, EMPTY_AAD)) === VERIFICATION_PLAINTEXT
  } catch {
    return false
  }
}
