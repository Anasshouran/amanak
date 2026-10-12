import { toBytes } from "./bytes"

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

async function hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toBytes(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, toBytes(data))
  return new Uint8Array(signature)
}

/**
 * Generate an RFC 6238 TOTP code.
 *
 * @param secret raw secret bytes (not base32-encoded)
 * @param now    epoch milliseconds; defaults to the current time
 */
export async function generateTotp(secret: Uint8Array, now: number = Date.now()): Promise<string> {
  const data = counterBytes(Math.floor(now / 1000))
  const hmac = await hmacSha1(secret, data)

  const offset = hmac[hmac.length - 1] & 0x0f
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3]

  return String(bin % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0")
}