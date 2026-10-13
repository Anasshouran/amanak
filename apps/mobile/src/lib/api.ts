/**
 * Mobile API wiring: base URL + expo-secure-store-backed token storage.
 *
 * The base URL is resolved by `./apiUrl` (see its resolution order). On a
 * physical device set `EXPO_PUBLIC_API_URL` to your machine's LAN IP.
 */

import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"
import { ApiClient } from "@amanak/api-client"
import { resolveApiUrl } from "./apiUrl"

const API_URL = resolveApiUrl()

const ACCESS_KEY = "amanak.access"
const REFRESH_KEY = "amanak.refresh"

// Web: localStorage (dev only — Expo web is a development target).
// Native: expo-secure-store (Keychain / Keystore).
// Production web uses apps/web with httpOnly cookies, not this file.

async function get(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return null
    return window.localStorage.getItem(key)
  }
  return SecureStore.getItemAsync(key)
}

async function set(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value)
    return
  }
  await SecureStore.setItemAsync(key, value)
}

async function remove(key: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.localStorage.removeItem(key)
    return
  }
  await SecureStore.deleteItemAsync(key)
}

export const tokens = {
  async setTokens(t: { access: string; refresh: string }): Promise<void> {
    await set(ACCESS_KEY, t.access)
    await set(REFRESH_KEY, t.refresh)
  },
  async getAccessToken(): Promise<string | null> {
    return get(ACCESS_KEY)
  },
  async getRefreshToken(): Promise<string | null> {
    return get(REFRESH_KEY)
  },
  async clear(): Promise<void> {
    await remove(ACCESS_KEY)
    await remove(REFRESH_KEY)
  },
}

export const api = new ApiClient(API_URL, tokens)