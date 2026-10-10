/**
 * Mobile API wiring: base URL + expo-secure-store-backed token storage.
 *
 * Change API_URL to your machine's LAN IP when testing on a physical device.
 */

import * as SecureStore from "expo-secure-store"
import { ApiClient } from "@amanak/api-client"
import { Platform } from "react-native"

const API_URL = `http://${Platform.select({ android: "10.0.2.2", default: "127.0.0.1" })}:8000`

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