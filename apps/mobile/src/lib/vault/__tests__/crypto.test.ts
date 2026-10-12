import { describe, it, expect } from "vitest"

import { ecb, gcm } from "@noble/ciphers/aes.js"
import { hmac } from "@noble/hashes/hmac.js"
import { sha1 } from "@noble/hashes/legacy.js"
import { pbkdf2 } from "@noble/hashes/pbkdf2.js"
import { sha256 } from "@noble/hashes/sha2.js"
import { concatBytes, utf8Encode } from "../bytes"

// P8.1: the hand-written AES/HMAC/PBKDF2 modules were replaced by @noble.
// These thin adapters keep every vector and assertion below byte-for-byte
// unchanged while exercising exactly the primitives production now uses.
const expandKey256 = (key: Uint8Array): Uint8Array => key
const encryptBlock = (block: Uint8Array, key: Uint8Array): Uint8Array =>
  ecb(key, { disablePadding: true }).encrypt(block)
const decryptBlock = (block: Uint8Array, key: Uint8Array): Uint8Array =>
  ecb(key, { disablePadding: true }).decrypt(block)
const gcmEncrypt = (key: Uint8Array, iv: Uint8Array, aad: Uint8Array, plaintext: Uint8Array): Uint8Array =>
  gcm(key, iv, aad).encrypt(plaintext)
const gcmDecrypt = (key: Uint8Array, iv: Uint8Array, aad: Uint8Array, ciphertext: Uint8Array): Uint8Array =>
  gcm(key, iv, aad).decrypt(ciphertext)
const hmacSha1 = (key: Uint8Array, message: Uint8Array): Uint8Array => hmac(sha1, key, message)
const hmacSha256 = (key: Uint8Array, message: Uint8Array): Uint8Array => hmac(sha256, key, message)
const pbkdf2Sha256 = (password: Uint8Array, salt: Uint8Array, iterations: number, dkLen: number): Uint8Array =>
  pbkdf2(sha256, password, salt, { c: iterations, dkLen })

const subtle: SubtleCrypto = (globalThis as unknown as { crypto: Crypto }).crypto.subtle

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex")
}

function fromHex(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "hex"))
}

/** Deterministic xorshift32 PRNG for reproducible fuzz inputs. */
function rng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state ^= state << 13
    state >>>= 0
    state ^= state >>> 17
    state ^= state << 5
    state >>>= 0
    return state
  }
}

function randomBytes(next: () => number, length: number): Uint8Array {
  const out = new Uint8Array(length)
  for (let i = 0; i < length; i++) out[i] = next() & 0xff
  return out
}

async function nodeDigest(algorithm: "SHA-1" | "SHA-256", data: Uint8Array): Promise<Uint8Array> {
  const copy = new Uint8Array(data.length)
  copy.set(data)
  return new Uint8Array(await subtle.digest(algorithm, copy))
}

async function nodeHmac(algorithm: "SHA-1" | "SHA-256", key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await subtle.importKey("raw", new Uint8Array(key), { name: "HMAC", hash: algorithm }, false, ["sign"])
  return new Uint8Array(await subtle.sign("HMAC", cryptoKey, new Uint8Array(data)))
}

async function nodeAesGcmKey(key: Uint8Array): Promise<CryptoKey> {
  return subtle.importKey("raw", new Uint8Array(key), { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
}

describe("SHA-1 / SHA-256", () => {
  it("matches the empty and 'abc' digests", () => {
    expect(hex(sha1(utf8Encode("")))).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709")
    expect(hex(sha1(utf8Encode("abc")))).toBe("a9993e364706816aba3e25717850c26c9cd0d89d")
    expect(hex(sha256(utf8Encode("")))).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
    expect(hex(sha256(utf8Encode("abc")))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
  })

  it("matches Node WebCrypto over random lengths", async () => {
    const next = rng(0x12345678)
    for (const length of [0, 1, 3, 55, 56, 63, 64, 65, 128, 500, 1000]) {
      const data = randomBytes(next, length)
      expect(hex(sha1(data))).toBe(hex(await nodeDigest("SHA-1", data)))
      expect(hex(sha256(data))).toBe(hex(await nodeDigest("SHA-256", data)))
    }
  })
})

describe("HMAC", () => {
  it("matches RFC 2202 HMAC-SHA1 test case 2", () => {
    const key = utf8Encode("Jefe")
    const data = utf8Encode("what do ya want for nothing?")
    expect(hex(hmacSha1(key, data))).toBe("effcdf6ae5eb2fa2d27416d5f184df9c259a7c79")
  })

  it("matches Node WebCrypto over random keys and messages", async () => {
    const next = rng(0x0badf00d)
    for (const keyLength of [1, 20, 64, 65, 200]) {
      for (const messageLength of [0, 1, 64, 129]) {
        const key = randomBytes(next, keyLength)
        const data = randomBytes(next, messageLength)
        expect(hex(hmacSha1(key, data))).toBe(hex(await nodeHmac("SHA-1", key, data)))
        expect(hex(hmacSha256(key, data))).toBe(hex(await nodeHmac("SHA-256", key, data)))
      }
    }
  })
})

describe("PBKDF2-HMAC-SHA256", () => {
  it("matches Node WebCrypto", async () => {
    for (const [password, salt, iterations, length] of [
      ["password", "salt", 1, 32],
      ["password", "salt", 2, 32],
      ["password", "salt", 4096, 32],
      ["pässwörd-السر", "0123456789abcdef", 1000, 48],
    ] as const) {
      const pw = utf8Encode(password)
      const s = utf8Encode(salt)
      const expected = await subtle.deriveBits(
        { name: "PBKDF2", salt: new Uint8Array(s), iterations, hash: "SHA-256" },
        await subtle.importKey("raw", new Uint8Array(pw), "PBKDF2", false, ["deriveBits"]),
        length * 8,
      )
      expect(hex(pbkdf2Sha256(pw, s, iterations, length))).toBe(hex(new Uint8Array(expected)))
    }
  })
})

describe("AES-256", () => {
  it("matches FIPS-197 C.3 known-answer vector", () => {
    const key = fromHex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f")
    const plaintext = fromHex("00112233445566778899aabbccddeeff")
    const w = expandKey256(key)
    const ciphertext = encryptBlock(plaintext, w)
    expect(hex(ciphertext)).toBe("8ea2b7ca516745bfeafc49904b496089")
    expect(hex(decryptBlock(ciphertext, w))).toBe(hex(plaintext))
  })

  it("round-trips random blocks", () => {
    const next = rng(0xae50)
    const key = randomBytes(next, 32)
    const w = expandKey256(key)
    for (let i = 0; i < 50; i++) {
      const block = randomBytes(next, 16)
      expect(hex(decryptBlock(encryptBlock(block, w), w))).toBe(hex(block))
    }
  })
})

describe("AES-256-GCM", () => {
  it("matches NIST test case 13 (empty plaintext/AAD, zero key+iv)", () => {
    const key = new Uint8Array(32)
    const iv = new Uint8Array(12)
    expect(hex(gcmEncrypt(key, iv, new Uint8Array(0), new Uint8Array(0)))).toBe("530f8afbc74536b9a963b4f1c4cb738b")
  })

  it("matches NIST test case 14 (one zero block)", () => {
    const key = new Uint8Array(32)
    const iv = new Uint8Array(12)
    const out = gcmEncrypt(key, iv, new Uint8Array(0), new Uint8Array(16))
    expect(hex(out)).toBe("cea7403d4d606b6e074ec5d3baf39d18d0d1c8a799996bf0265b98b5d48ab919")
  })

  it("matches the zero-key/zero-iv AAD-only vector", () => {
    const key = new Uint8Array(32)
    const iv = new Uint8Array(12)
    expect(hex(gcmEncrypt(key, iv, new Uint8Array(16), new Uint8Array(0)))).toBe("2d45552d8575922b3ca3cc538442fa26")
  })

  it("is byte-for-byte compatible with Node WebCrypto", async () => {
    const next = rng(0x6c6d)
    for (const [ptLength, aadLength] of [
      [0, 0],
      [1, 0],
      [16, 16],
      [32, 8],
      [100, 33],
    ] as const) {
      const key = randomBytes(next, 32)
      const iv = randomBytes(next, 12)
      const aad = randomBytes(next, aadLength)
      const plaintext = randomBytes(next, ptLength)

      const ours = gcmEncrypt(key, iv, aad, plaintext)
      const cryptoKey = await nodeAesGcmKey(key)
      const theirs = new Uint8Array(
        await subtle.encrypt(
          { name: "AES-GCM", iv: new Uint8Array(iv), additionalData: new Uint8Array(aad) },
          cryptoKey,
          new Uint8Array(plaintext),
        ),
      )
      expect(hex(ours)).toBe(hex(theirs))

      // Web -> mobile
      expect(hex(gcmDecrypt(key, iv, aad, theirs))).toBe(hex(plaintext))
      // Mobile -> web
      const decrypted = new Uint8Array(
        await subtle.decrypt(
          { name: "AES-GCM", iv: new Uint8Array(iv), additionalData: new Uint8Array(aad) },
          cryptoKey,
          new Uint8Array(ours),
        ),
      )
      expect(hex(decrypted)).toBe(hex(plaintext))
    }
  })

  it("rejects tampered ciphertext, wrong key and wrong AAD", () => {
    const key = utf8Encode("a-fixed-32-byte-key-for-tests!!!").slice(0, 32)
    const iv = new Uint8Array(12).fill(7)
    const aad = new Uint8Array(8)
    const blob = gcmEncrypt(key, iv, aad, utf8Encode("JBSWY3DPEHPK3PXP"))

    const tampered = new Uint8Array(blob)
    tampered[0] ^= 0x01
    expect(() => gcmDecrypt(key, iv, aad, tampered)).toThrow()

    const wrongKey = new Uint8Array(key)
    wrongKey[0] ^= 0x01
    expect(() => gcmDecrypt(wrongKey, iv, aad, blob)).toThrow()

    const wrongAad = concatBytes(aad, Uint8Array.of(1))
    expect(() => gcmDecrypt(key, iv, wrongAad, blob)).toThrow()

    expect(hex(gcmDecrypt(key, iv, aad, blob))).toBe(hex(utf8Encode("JBSWY3DPEHPK3PXP")))
  })
})