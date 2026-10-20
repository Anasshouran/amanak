import { describe, expect, it } from "vitest"

import { aadFromEntryId, decrypt, encrypt } from "../aes"
import { deriveKey, generateSalt } from "../kdf"
import { generateRecoveryCodes, unwrapKeyWithRecovery } from "../recovery"

async function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"])
}

describe("recovery codes", () => {
  it("generates 10 unique valid codes", async () => {
    const K = await makeKey()
    const { codes, stored } = await generateRecoveryCodes(K, 10)
    expect(codes).toHaveLength(10)
    expect(stored).toHaveLength(10)
    const set = new Set(codes)
    expect(set.size).toBe(10)
    for (const c of codes) {
      expect(c).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}$/)
    }
  }, 30_000)

  it("wraps and unwraps K with a recovery code", async () => {
    const K = await makeKey()
    const { codes, stored } = await generateRecoveryCodes(K, 1)
    const recovered = await unwrapKeyWithRecovery(codes[0], stored[0])
    // verify by encrypting/decrypting a known plaintext with both keys
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const pt = new TextEncoder().encode("hello")
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, K, pt)
    const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, recovered, ct)
    expect(new TextDecoder().decode(dec)).toBe("hello")
  })

  it("fails with a wrong code", async () => {
    const K = await makeKey()
    const { codes, stored } = await generateRecoveryCodes(K, 1)
    const wrongCode = "ZZZZ-ZZZZ-ZZZZ-ZZZZ"
    await expect(unwrapKeyWithRecovery(wrongCode, stored[0])).rejects.toThrow()
  })

  it("normalizes codes (hyphens stripped, uppercase)", async () => {
    const K = await makeKey()
    const { codes, stored } = await generateRecoveryCodes(K, 1)
    const code = codes[0]
    const normalized = code.replace(/-/g, "").toLowerCase()
    const recovered = await unwrapKeyWithRecovery(normalized, stored[0])
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const pt = new TextEncoder().encode("x")
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, K, pt)
    const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, recovered, ct)
    expect(new TextDecoder().decode(dec)).toBe("x")
  })

  it("wrapped blob is not the plaintext K", async () => {
    const K = await makeKey()
    const rawK = new Uint8Array(await crypto.subtle.exportKey("raw", K))
    const { stored } = await generateRecoveryCodes(K, 1)
    // ciphertext (wrapped) should differ from raw K
    expect(stored[0].ciphertext.length).toBeGreaterThan(0)
    let same = true
    if (stored[0].ciphertext.length === rawK.length) {
      same = stored[0].ciphertext.every((b, i) => b === rawK[i])
    } else {
      same = false
    }
    expect(same).toBe(false)
  })

  it("full recovery flow: A → recovery → B → unlock B, old password dead", async () => {
    // Setup with password A (extractable so it can be wrapped into recovery codes)
    const passwordA = "OldPassword123!"
    const saltA = generateSalt()
    const KA = await deriveKey(passwordA, saltA, 310_000, true)
    const entryIdAad = aadFromEntryId(1)
    const secret = new TextEncoder().encode("JBSWY3DPEHPK3PXP")
    const { ciphertext: ctA, iv: ivA } = await encrypt(KA, secret, entryIdAad)

    // Generate recovery codes
    const { codes, stored } = await generateRecoveryCodes(KA, 10)

    // Recover via code → unwrap K_old
    const KA_recovered = await unwrapKeyWithRecovery(codes[0], stored[0])

    // Recovered key decrypts the original ciphertext (proves it equals KA)
    const recoveredPlaintext = await decrypt(KA_recovered, ctA, ivA, entryIdAad)
    expect(Array.from(recoveredPlaintext)).toEqual(Array.from(secret))

    // Re-encrypt with password B (new salt, new key)
    const passwordB = "NewPassword456!"
    const saltB = generateSalt()
    const KB = await deriveKey(passwordB, saltB, 310_000)
    const { ciphertext: ctB, iv: ivB } = await encrypt(KB, recoveredPlaintext, entryIdAad)

    // B decrypts correctly
    const decrypted = await decrypt(KB, ctB, ivB, entryIdAad)
    expect(Array.from(decrypted)).toEqual(Array.from(secret))

    // A (old key) fails to decrypt the new ciphertext
    await expect(decrypt(KA, ctB, ivB, entryIdAad)).rejects.toThrow()
  }, 30_000)
})
