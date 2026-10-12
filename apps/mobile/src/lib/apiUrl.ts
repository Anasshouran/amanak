import { Platform } from "react-native"

/**
 * Pure platform -> base URL mapping.
 *
 * Kept separate from `resolveApiUrl` so it can be unit-tested without mocking
 * React Native. Resolution order:
 *
 * 1. `EXPO_PUBLIC_API_URL` (explicit override)
 * 2. Android emulator loopback (`10.0.2.2`)
 * 3. iOS simulator / Expo web loopback (`127.0.0.1`)
 * 4. otherwise fail fast — a physical device cannot guess the host LAN IP.
 */
export function pickApiUrl(platform: string, envUrl?: string): string {
  const fromEnv = envUrl?.trim()
  if (fromEnv) return fromEnv

  if (platform === "android") return "http://10.0.2.2:8080"
  if (platform === "ios") return "http://127.0.0.1:8080"
  if (platform === "web") return "http://127.0.0.1:8080"

  throw new Error(
    "EXPO_PUBLIC_API_URL is not set. On a physical device, set it to the LAN " +
      "IP of your development machine, e.g. " +
      "EXPO_PUBLIC_API_URL=http://192.168.1.5:8080 npx expo start",
  )
}

export function resolveApiUrl(): string {
  return pickApiUrl(Platform.OS, process.env.EXPO_PUBLIC_API_URL)
}
