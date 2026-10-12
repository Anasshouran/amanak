import * as Crypto from "expo-crypto"

/** Cryptographically secure random bytes from the platform CSPRNG. */
export function randomBytes(size: number): Uint8Array {
  return new Uint8Array(Crypto.getRandomBytes(size))
}