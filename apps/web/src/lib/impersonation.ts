/**
 * Client-side staff impersonation session (P13.3).
 *
 * The authoritative session lives on the server (time-boxed, audited). The
 * client only remembers *which* target is being viewed; the value is sent as
 * the ``X-Impersonate-User-Id`` header so the backend serves the target's
 * (read-only) view.
 */

const KEY = "amanak.impersonation"

export type Impersonation = {
  userId: number
  email: string
  sessionId: number
  /** Unix epoch milliseconds when the server session expires. */
  expiresAt: number
}

function read(): Impersonation | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Impersonation
    if (!parsed || typeof parsed.userId !== "number" || typeof parsed.expiresAt !== "number") {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function getImpersonation(): Impersonation | null {
  const state = read()
  if (!state) return null
  if (state.expiresAt <= Date.now()) return null
  return state
}

export function setImpersonation(state: Impersonation): void {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(KEY, JSON.stringify(state))
  window.dispatchEvent(new Event(KEY))
}

export function clearImpersonation(): void {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(KEY)
  window.dispatchEvent(new Event(KEY))
}

export function subscribeImpersonation(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(KEY, listener)
  return () => window.removeEventListener(KEY, listener)
}

export function impersonationHeader(): { userId: number } | null {
  const state = getImpersonation()
  return state ? { userId: state.userId } : null
}

export function remainingSeconds(state: Impersonation, now = Date.now()): number {
  return Math.max(0, Math.round((state.expiresAt - now) / 1000))
}
