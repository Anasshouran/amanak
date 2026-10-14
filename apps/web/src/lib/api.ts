import { ApiClient } from "@amanak/api-client"
import { clearImpersonation, impersonationHeader } from "./impersonation"

const BASE_URL =
  (import.meta.env as { VITE_API_URL?: string }).VITE_API_URL ?? "http://127.0.0.1:8000"

// The access token is held in memory only. The refresh token lives in an
// HttpOnly cookie set by the backend and is never readable by JavaScript.
let accessToken: string | null = null

export type StoredTokens = { access: string; refresh: string }

export const tokens: {
  getAccessToken: () => Promise<string | null>
  getRefreshToken: () => Promise<string | null>
  setTokens: (t: StoredTokens) => Promise<void>
  clear: () => Promise<void>
} = {
  async getAccessToken() {
    return accessToken
  },
  async getRefreshToken() {
    return null
  },
  async setTokens(t: StoredTokens) {
    accessToken = t.access
  },
  async clear() {
    accessToken = null
  },
}

async function refreshAccess(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/refresh-token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    })
    if (!res.ok) return null
    const data = (await res.json()) as { access?: string }
    if (!data.access) return null
    accessToken = data.access
    return data.access
  } catch {
    return null
  }
}

// Routes that render without a session. A 401 while on one of these must not
// force a redirect, otherwise direct navigation to e.g. /register bounces to
// /login, and the public landing page would redirect anonymous visitors.
const PUBLIC_ROUTES = new Set(["/", "/login", "/register"])

export const api = new ApiClient(BASE_URL, tokens, {
  credentials: "include",
  refreshAccess,
  getImpersonation: impersonationHeader,
  onForbidden: (error) => {
    // An impersonation session that the server rejects (read-only violation or
    // revoked session) is over: drop it and return to the staff dashboard.
    if (error.code === "impersonation_read_only" || error.code === "impersonation_forbidden") {
      clearImpersonation()
      if (typeof window !== "undefined") {
        window.location.assign("/staff")
      }
    }
  },
  onUnauthorized: () => {
    void tokens.clear()
    if (typeof window !== "undefined" && !PUBLIC_ROUTES.has(window.location.pathname)) {
      window.location.assign("/login")
    }
  },
})
