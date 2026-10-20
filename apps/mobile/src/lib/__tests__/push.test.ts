/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest"

// Web case: Platform.OS === "web" → returns null without touching notifications
describe("registerForPush (web)", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("returns null on web", async () => {
    vi.doMock("react-native", () => ({ Platform: { OS: "web" } }))
    vi.doMock("expo-notifications", () => ({}))
    vi.doMock("expo-device", () => ({ isDevice: true }))
    vi.doMock("../api", () => ({ api: { registerPushToken: vi.fn() } }))

    const { registerForPush } = await import("../push")
    const result = await registerForPush()
    expect(result).toBeNull()
  })
})

// Native case: mocked native modules → returns a token
describe("registerForPush (native)", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("registers and returns the token on a device", async () => {
    const registerPushToken = vi.fn(async () => ({ id: 1, token: "ExpoPushToken[test]" }))
    vi.doMock("react-native", () => ({ Platform: { OS: "ios" } }))
    vi.doMock("expo-notifications", () => ({
      getPermissionsAsync: vi.fn(async () => ({ status: "granted" })),
      requestPermissionsAsync: vi.fn(async () => ({ status: "granted" })),
      getExpoPushTokenAsync: vi.fn(async () => ({ data: "ExpoPushToken[test]" })),
      setNotificationHandler: vi.fn(),
      addNotificationResponseReceivedListener: vi.fn(),
    }))
    vi.doMock("expo-device", () => ({ isDevice: true }))
    vi.doMock("../api", () => ({ api: { registerPushToken } }))

    const { registerForPush } = await import("../push")
    const result = await registerForPush()
    expect(result).toBe("ExpoPushToken[test]")
    expect(registerPushToken).toHaveBeenCalledWith({ token: "ExpoPushToken[test]", platform: "ios" })
  })
})
