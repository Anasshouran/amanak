/**
 * PBKDF2-SHA256 master key derivation (P8, server-blind).
 *
 * The master password is used only here, in memory, and the derived key is
 * non-extractable. 310,000 iterations is the OWASP 2023 minimum for
 * PBKDF2-SHA256. The salt (32 bytes) is generated on the client at first
 * setup and stored server-side; it is not a secret.
 */

import { toBytes } from "./bytes"

export async function deriveKey(
  masterPassword: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    toBytes(new TextEncoder().encode(masterPassword)),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toBytes(salt),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // never extractable
    ["encrypt", "decrypt"],
  )
}

/** Generate a fresh 32-byte KDF salt. */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}