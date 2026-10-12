/**
 * Session-scoped in-memory key holder (P8).
 *
 * The derived key lives here and nowhere else: never localStorage, never
 * sessionStorage, never sent anywhere. Locking discards the reference; the
 * calling page also drives the 5-minute inactivity auto-lock.
 */

let activeKey: CryptoKey | null = null

export function unlock(key: CryptoKey): void {
  activeKey = key
}

export function lock(): void {
  activeKey = null
}

export function isUnlocked(): boolean {
  return activeKey !== null
}

/**
 * Run a function with the in-memory key. Returns null when the vault is
 * locked, letting callers show the unlock screen.
 */
export async function withKey<T>(fn: (key: CryptoKey) => Promise<T>): Promise<T | null> {
  if (!activeKey) return null
  return fn(activeKey)
}