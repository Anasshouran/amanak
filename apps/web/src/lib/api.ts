import { ApiClient } from "@amanak/api-client"

const BASE_URL =
  (import.meta.env as { VITE_API_URL?: string }).VITE_API_URL ?? "http://127.0.0.1:8000"

export type StoredTokens = { access: string; refresh: string }

const ACCESS_KEY = "amanak.access"
const REFRESH_KEY = "amanak.refresh"

export const tokens: {
  getAccessToken: () => Promise<string | null>
  getRefreshToken: () => Promise<string | null>
  setTokens: (t: StoredTokens) => Promise<void>
  clear: () => Promise<void>
} = {
  async getAccessToken() {
    return localStorage.getItem(ACCESS_KEY)
  },
  async getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY)
  },
  async setTokens(t: StoredTokens) {
    localStorage.setItem(ACCESS_KEY, t.access)
    localStorage.setItem(REFRESH_KEY, t.refresh)
  },
  async clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export const api = new ApiClient(BASE_URL, tokens)