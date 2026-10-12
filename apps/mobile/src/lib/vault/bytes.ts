/** Byte helpers for the pure-TS vault crypto (P8 mobile mirror). */

const enc = new TextEncoder()
const dec = new TextDecoder()

export function utf8Encode(value: string): Uint8Array {
  return enc.encode(value)
}

export function utf8Decode(bytes: Uint8Array): string {
  return dec.decode(bytes)
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let total = 0
  for (const a of arrays) total += a.length
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) {
    out.set(a, offset)
    offset += a.length
  }
  return out
}

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

/** Base64 encode (RFC 4648) matching the browser btoa() byte-string output. */
export function b64Encode(bytes: Uint8Array): string {
  let out = ""
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
    out += BASE64_ALPHABET[b0 >> 2]
    out += BASE64_ALPHABET[((b0 & 3) << 4) | (b1 >> 4)]
    out += i + 1 < bytes.length ? BASE64_ALPHABET[((b1 & 15) << 2) | (b2 >> 6)] : "="
    out += i + 2 < bytes.length ? BASE64_ALPHABET[b2 & 63] : "="
  }
  return out
}

/** Base64 decode (RFC 4648) accepting canonical encodings. */
export function b64Decode(value: string): Uint8Array {
  const clean = value.replace(/[^A-Za-z0-9+/]/g, "")
  if (clean.length % 4 === 1) throw new Error("Invalid base64 input")
  const out: number[] = []
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = charIndex(clean[i])
    const c1 = charIndex(clean[i + 1])
    const c2 = clean[i + 2] ? charIndex(clean[i + 2]) : 0
    const c3 = clean[i + 3] ? charIndex(clean[i + 3]) : 0
    out.push((c0 << 2) | (c1 >> 4))
    if (clean[i + 2] && clean[i + 2] !== "=") out.push(((c1 & 15) << 4) | (c2 >> 2))
    if (clean[i + 3] && clean[i + 3] !== "=") out.push(((c2 & 3) << 6) | c3)
  }
  return Uint8Array.from(out)
}

function charIndex(ch: string): number {
  const idx = BASE64_ALPHABET.indexOf(ch)
  if (idx < 0) throw new Error("Invalid base64 character")
  return idx
}