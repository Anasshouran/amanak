/**
 * Recovery codes for the server-blind 2FA vault (P20.2).
 *
 * 10 single-use codes, each wrapping the vault key K via AES-256-GCM using
 * wrapKey/unwrapKey so K never becomes extractable. The server only ever
 * sees SHA-256(normalized code) + the wrapped (encrypted) K.
 */

import { PBKDF2_ITERATIONS } from "./kdf"
import { toBytes } from "./bytes"

async function deriveRecoveryKey(code: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    toBytes(new TextEncoder().encode(code)),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toBytes(salt), iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  )
}

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"
const AAD = new TextEncoder().encode("recovery")

export type StoredRecoveryCode = {
  code_hash: string // hex SHA-256 of normalized code
  salt: Uint8Array // 16 bytes
  ciphertext: Uint8Array // wrapped K (includes auth tag)
  iv: Uint8Array // 12 bytes
}

function normalize(code: string): string {
  return code.replace(/-/g, "").trim().toUpperCase()
}

function generateCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let out = ""
  for (let i = 0; i < 16; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}`
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function generateRecoveryCodes(
  K: CryptoKey,
  count: number = 10,
): Promise<{ codes: string[]; stored: StoredRecoveryCode[] }> {
  const codes: string[] = []
  const stored: StoredRecoveryCode[] = []

  for (let i = 0; i < count; i++) {
    const code = generateCode()
    const normalized = normalize(code)
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const Kc = await deriveRecoveryKey(normalized, salt, PBKDF2_ITERATIONS)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const wrapped = await crypto.subtle.wrapKey("raw", K, Kc, {
      name: "AES-GCM",
      iv: toBytes(iv),
      additionalData: toBytes(AAD),
    })
    const hash = await sha256Hex(normalized)
    codes.push(code)
    stored.push({ code_hash: hash, salt, ciphertext: new Uint8Array(wrapped), iv })
  }
  return { codes, stored }
}

export async function deriveKeyFromRecoveryCode(
  code: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const normalized = normalize(code)
  return deriveRecoveryKey(normalized, salt, iterations)
}

export async function unwrapKeyWithRecovery(
  code: string,
  stored: { salt: Uint8Array; ciphertext: Uint8Array; iv: Uint8Array },
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const Kc = await deriveRecoveryKey(normalize(code), stored.salt, iterations)
  const K = await crypto.subtle.unwrapKey(
    "raw",
    toBytes(stored.ciphertext),
    Kc,
    { name: "AES-GCM", iv: toBytes(stored.iv), additionalData: toBytes(AAD) },
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
  return K
}
