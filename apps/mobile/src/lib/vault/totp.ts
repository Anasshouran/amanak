/** RFC 6238 TOTP over HMAC-SHA1 (P8.1: HMAC/SHA-1 from @noble/hashes). */

import { hmac } from "@noble/hashes/hmac.js"
import { sha1 } from "@noble/hashes/legacy.js"

export const TOTP_STEP_SECONDS = 30
export const TOTP_DIGITS = 6

function counterBytes(nowSeconds: number): Uint8Array {
  let value = Math.floor(nowSeconds / TOTP_STEP_SECONDS)
  const msg = new Uint8Array(8)
  for (let i = 7; i >= 0; i--) {
    msg[i] = value % 256
    value = Math.floor(value / 256)
  }
  return msg
}

/**
 * Generate an RFC 6238 TOTP code.
 *
 * @param secret raw secret bytes (not base32-encoded)
 * @param now    epoch milliseconds; defaults to the current time
 */
export function generateTotp(secret: Uint8Array, now: number = Date.now()): string {
  const mac = hmac(sha1, secret, counterBytes(Math.floor(now / 1000)))
  const offset = mac[mac.length - 1] & 0x0f
  const bin =
    ((mac[offset] & 0x7f) << 24) |
    (mac[offset + 1] << 16) |
    (mac[offset + 2] << 8) |
    mac[offset + 3]
  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0")
}

export function totpSecondsRemaining(now: number = Date.now()): number {
  const seconds = Math.floor(now / 1000)
  return TOTP_STEP_SECONDS - (seconds % TOTP_STEP_SECONDS)
}