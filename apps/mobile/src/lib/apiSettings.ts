/**
 * Runtime API base URL override (test/self-hosted builds only).
 *
 * A release APK bakes `EXPO_PUBLIC_API_URL` at build time, so pointing the app
 * at a new backend — a restarted cloudflared tunnel hands out a new random
 * hostname every time — used to mean rebuilding and reinstalling. This module
 * stores an override on the device and repoints the shared `ApiClient`.
 *
 * The feature is dormant unless the build was made with
 * `EXPO_PUBLIC_ALLOW_API_OVERRIDE=1`. Store builds must not set it: an override
 * screen hands anyone holding the phone a way to redirect credentials to a host
 * of their choosing.
 */
import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"
import { api, BAKED_API_URL } from "./api"
import { normalizeApiUrl } from "./apiUrl"

export const API_OVERRIDE_ENABLED = process.env.EXPO_PUBLIC_ALLOW_API_OVERRIDE === "1"

const KEY = "amanak.apiBaseUrl"

const store = {
  async get(): Promise<string | null> {
    if (Platform.OS === "web") {
      return typeof window === "undefined" ? null : window.localStorage.getItem(KEY)
    }
    return SecureStore.getItemAsync(KEY)
  },
  async set(value: string): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.setItem(KEY, value)
      return
    }
    await SecureStore.setItemAsync(KEY, value)
  },
  async remove(): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.localStorage.removeItem(KEY)
      return
    }
    await SecureStore.deleteItemAsync(KEY)
  },
}

/** Apply a saved override, if the build allows one. Returns the active URL. */
export async function loadApiOverride(): Promise<string> {
  if (!API_OVERRIDE_ENABLED) return api.getBaseUrl()
  try {
    const saved = await store.get()
    const normalized = saved ? normalizeApiUrl(saved) : null
    if (normalized) api.setBaseUrl(normalized)
  } catch {
    // A broken keystore must not block the app from starting on the baked URL.
  }
  return api.getBaseUrl()
}

/** Validate, persist and apply an override. Throws on an unusable URL. */
export async function saveApiOverride(input: string): Promise<string> {
  const normalized = normalizeApiUrl(input)
  if (!normalized) {
    throw new Error("Enter a full http:// or https:// URL, e.g. https://api.example.com")
  }
  await store.set(normalized)
  api.setBaseUrl(normalized)
  return normalized
}

/** Forget the override and go back to the URL baked into the build. */
export async function clearApiOverride(): Promise<string> {
  await store.remove()
  api.setBaseUrl(BAKED_API_URL)
  return BAKED_API_URL
}

export function currentApiUrl(): string {
  return api.getBaseUrl()
}
