import { ApiClient, setContextId as _setContextId } from "@amanak/api-client"
import { clearImpersonation, impersonationHeader } from "./impersonation"

// Re-exported so callers import the context helpers from the app's api module
// alongside `api` (P18.1c2).
export { getContextId, setContextId } from "@amanak/api-client"

// Initialize the tenant context before the first authenticated request fires
// (AuthContext calls api.me() during mount; ContextProvider mounts later).
if (typeof window !== "undefined") {
  try {
    const stored = window.localStorage.getItem("amanak.context")
    _setContextId(stored || null)
  } catch {
    /* ignore — non-browser or storage unavailable */
  }
}

const BASE_URL =
  (import.meta.env as { VITE_API_URL?: string }).VITE_API_URL ?? "http://127.0.0.1:8080"

// The access token is held in memory and mirrored to sessionStorage so it
// survives an intentional page reload (P18.1c2 context switch). The refresh
// token lives in an HttpOnly cookie set by the backend.
let accessToken: string | null = null

export type StoredTokens = { access: string; refresh: string }

const SESSION_TOKEN_KEY = "amanak.access"

// Hydrate the in-memory token from sessionStorage on module load (survives
// page reload but is cleared when the tab is closed).
if (typeof window !== "undefined") {
  try {
    accessToken = window.sessionStorage.getItem(SESSION_TOKEN_KEY) ?? null
  } catch {
    /* storage unavailable */
  }
}

export const tokens: {
  getAccessToken: () => Promise<string | null>
  getRefreshToken: () => Promise<string | null>
  setTokens: (t: StoredTokens) => Promise<void>
  clear: () => Promise<void>
} = {
  async getAccessToken() {
    if (accessToken) return accessToken
    if (typeof window !== "undefined") {
      try {
        accessToken = window.sessionStorage.getItem(SESSION_TOKEN_KEY) ?? null
      } catch {
        /* storage unavailable */
      }
    }
    return accessToken
  },
  async getRefreshToken() {
    return null
  },
  async setTokens(t: StoredTokens) {
    accessToken = t.access
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(SESSION_TOKEN_KEY, t.access)
      } catch {
        /* storage unavailable */
      }
    }
  },
  async clear() {
    accessToken = null
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(SESSION_TOKEN_KEY)
      } catch {
        /* storage unavailable */
      }
    }
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
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(SESSION_TOKEN_KEY, data.access)
      } catch {
        /* storage unavailable */
      }
    }
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
