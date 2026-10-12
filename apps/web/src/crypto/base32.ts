const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

/**
 * Decode a base32 string (RFC 4648) into bytes. Accepts upper/lower case,
 * optional padding, and skips whitespace and dashes.
 */
export function decode(input: string): Uint8Array {
  const cleaned = input.replace(/=+$/, "").replace(/[\s-]/g, "").toUpperCase()
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of cleaned) {
    const idx = ALPHABET.indexOf(ch)
    if (idx < 0) {
      throw new Error(`Invalid base32 character: ${ch}`)
    }
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Uint8Array.from(out)
}

/**
 * Encode bytes into a padded, uppercase base32 string (RFC 4648).
 */
export function encode(bytes: Uint8Array | ArrayLike<number>): string {
  let bits = 0
  let value = 0
  let out = ""
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    out += ALPHABET[(value << (5 - bits)) & 31]
  }
  return out.padEnd(Math.ceil(out.length / 8) * 8, "=")
}