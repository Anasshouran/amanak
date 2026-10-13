/**
 * Client-side password generator (P9 mobile mirror).
 *
 * Uses the platform CSPRNG (`expo-crypto`) with rejection sampling (no modulo
 * bias) and mirrors the web generator's character sets and length bounds.
 */

import { randomBytes } from "./random"

export const MIN_LENGTH = 12
export const MAX_LENGTH = 64

const LOWER = "abcdefghijklmnopqrstuvwxyz"
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const DIGITS = "0123456789"
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?/"
const AMBIGUOUS = new Set(["0", "O", "1", "l", "I"])

export type PasswordGeneratorOptions = {
  length: number
  lower: boolean
  upper: boolean
  digits: boolean
  symbols: boolean
  excludeAmbiguous: boolean
}

export function defaultGeneratorOptions(): PasswordGeneratorOptions {
  return {
    length: 20,
    lower: true,
    upper: true,
    digits: true,
    symbols: true,
    excludeAmbiguous: true,
  }
}

function strip(charset: string, excludeAmbiguous: boolean): string {
  if (!excludeAmbiguous) return charset
  return [...charset].filter((char) => !AMBIGUOUS.has(char)).join("")
}

function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) throw new Error("randomInt requires a positive bound.")
  const limit = 256 - (256 % maxExclusive)
  for (;;) {
    const byte = randomBytes(1)[0]
    if (byte < limit) return byte % maxExclusive
  }
}

function pick(charset: string): string {
  return charset[randomInt(charset.length)]
}

export function generatePassword(options: PasswordGeneratorOptions): string {
  const sets: string[] = []
  if (options.lower) sets.push(strip(LOWER, options.excludeAmbiguous))
  if (options.upper) sets.push(strip(UPPER, options.excludeAmbiguous))
  if (options.digits) sets.push(strip(DIGITS, options.excludeAmbiguous))
  if (options.symbols) sets.push(SYMBOLS)

  if (sets.length === 0) {
    throw new Error("Select at least one character set.")
  }

  const length = Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, Math.floor(options.length)))
  const pool = sets.join("")

  const chars: string[] = sets.map((set) => pick(set))
  while (chars.length < length) chars.push(pick(pool))

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join("")
}
