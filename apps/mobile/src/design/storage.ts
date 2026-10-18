import { Platform } from "react-native"

/**
 * Small preference store for theme/locale.
 *
 * Mirrors the storage split already used by `src/lib/api.ts`: `localStorage` on
 * web (where Expo Web is a development target and reads must be synchronous to
 * avoid a theme flash) and `expo-secure-store` on device.
 *
 * `expo-secure-store` is loaded lazily — importing it eagerly pulls in
 * `expo-modules-core`, which needs native bindings that web/test hosts do not
 * provide, and the web path never touches it at all.
 *
 * Only ever holds UI preferences — never tokens or secrets.
 */

type SecureStoreModule = typeof import("expo-secure-store")

let secureStoreModule: Promise<SecureStoreModule | null> | null = null

function secureStore(): Promise<SecureStoreModule | null> {
  if (!secureStoreModule) {
    secureStoreModule = import("expo-secure-store").catch(() => null)
  }
  return secureStoreModule
}

const prefs = new Map<string, string>()

export function isLocalStorageBacked(): boolean {
  return Platform.OS === "web" && typeof window !== "undefined"
}

/** Synchronous read. Returns `null` on native until `loadStore()` resolves. */
export function readStoreSync(key: string): string | null {
  if (isLocalStorageBacked()) return window.localStorage.getItem(key)
  return prefs.get(key) ?? null
}

export async function loadStore(key: string): Promise<string | null> {
  if (isLocalStorageBacked()) return window.localStorage.getItem(key)
  const cached = prefs.get(key)
  if (cached !== undefined) return cached
  const Store = await secureStore()
  if (!Store) return null
  try {
    const value = await Store.getItemAsync(key)
    if (value !== null) prefs.set(key, value)
    return value
  } catch {
    return null
  }
}

export async function writeStore(key: string, value: string): Promise<void> {
  if (isLocalStorageBacked()) {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      /* storage unavailable */
    }
    return
  }
  prefs.set(key, value)
  const Store = await secureStore()
  if (!Store) return
  try {
    await Store.setItemAsync(key, value)
  } catch {
    /* keystore unavailable */
  }
}
