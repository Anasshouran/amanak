/**
 * Mobile API wiring: base URL + expo-secure-store-backed token storage.
 *
 * The base URL is resolved by `./apiUrl` (see its resolution order). On a
 * physical device set `EXPO_PUBLIC_API_URL` to your machine's LAN IP.
 */

import * as SecureStore from "expo-secure-store"
import { ApiClient } from "@amanak/api-client"
import { resolveApiUrl } from "./apiUrl"

const API_URL = resolveApiUrl()

const ACCESS_KEY = "amanak.access"
const REFRESH_KEY = "amanak.refresh"

export const tokens = {
  async getAccessToken() {
    return SecureStore.getItemAsync(ACCESS_KEY)
  },
  async getRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_KEY)
  },
  async setTokens(t: { access: string; refresh: string }) {
    await SecureStore.setItemAsync(ACCESS_KEY, t.access)
    await SecureStore.setItemAsync(REFRESH_KEY, t.refresh)
  },
  async clear() {
    await SecureStore.deleteItemAsync(ACCESS_KEY)
    await SecureStore.deleteItemAsync(REFRESH_KEY)
  },
}

export const api = new ApiClient(API_URL, tokens)