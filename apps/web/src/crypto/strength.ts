/**
 * Minimal password-strength scorer (P9).
 *
 * Deliberately dependency-free and free of regex backreferences (which are not
 * supported consistently across engines). It is a hint for the UI, never a
 * security control: real strength comes from length and unpredictability.
 */

const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl"]

function hasSequence(lower: string): boolean {
  for (const sequence of SEQUENCES) {
    for (let i = 0; i + 3 <= sequence.length; i++) {
      if (lower.includes(sequence.slice(i, i + 3))) return true
    }
  }
  return false
}

function countRuns(password: string): number {
  let runs = 0
  let run = 1
  for (let i = 1; i < password.length; i++) {
    if (password[i] === password[i - 1]) {
      run += 1
      if (run === 3) runs += 1
    } else {
      run = 1
    }
  }
  return runs
}

/** Score a password from 0 (empty) to 100 (strong). */
export function scorePassword(password: string): number {
  if (!password) return 0

  let score = Math.min(45, password.length * 3)

  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length
  score += (classes - 1) * 12

  const unique = new Set(password).size
  score += Math.min(20, unique * 2)

  const lower = password.toLowerCase()
  if (/password|qwerty|123456|admin|letmein|welcome/.test(lower)) score -= 30
  if (hasSequence(lower)) score -= 10
  score -= countRuns(password) * 8

  return Math.max(0, Math.min(100, Math.round(score)))
}

export type StrengthLabel = "weak" | "fair" | "good" | "strong"

export function strengthLabel(score: number): StrengthLabel {
  if (score < 40) return "weak"
  if (score < 60) return "fair"
  if (score < 80) return "good"
  return "strong"
}
