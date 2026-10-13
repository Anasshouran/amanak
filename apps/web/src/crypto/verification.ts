/**
 * Vault verification blob (P9.1).
 *
 * To prove the master password even when the vault has no entries, setup
 * encrypts a fixed, public plaintext with the derived key (empty AAD) and
 * stores the blob on the profile. Unlock decrypts it first: success means the
 * key is right, failure means the password is wrong. The plaintext is not a
 * secret — it only exists so a wrong key cannot accidentally "unlock" an empty
 * vault and silently corrupt it with a different key.
 */

import { decrypt, encrypt, type AesGcmResult } from "./aes"

export const VERIFICATION_PLAINTEXT = "AMANAK-PWD-VAULT-V1"

/** Encrypt the fixed verification plaintext with a fresh 12-byte IV. */
export async function createVerification(key: CryptoKey): Promise<AesGcmResult> {
  const plaintext = new TextEncoder().encode(VERIFICATION_PLAINTEXT)
  return encrypt(key, plaintext, new Uint8Array(0))
}

/** True when `key` decrypts the blob back to the fixed plaintext. */
export async function verifyKey(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
): Promise<boolean> {
  try {
    const plaintext = await decrypt(key, ciphertext, iv, new Uint8Array(0))
    return new TextDecoder().decode(plaintext) === VERIFICATION_PLAINTEXT
  } catch {
    return false
  }
}
