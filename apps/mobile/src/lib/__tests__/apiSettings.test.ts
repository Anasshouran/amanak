import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("react-native", () => ({ Platform: { OS: "ios", isTV: false } }))

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}))

let currentUrl = "http://baked:8080"
const apiMock = {
  setBaseUrl: vi.fn((u: string) => {
    currentUrl = u
  }),
  getBaseUrl: vi.fn(() => currentUrl),
}

vi.mock("../api", () => ({
  api: apiMock,
  BAKED_API_URL: "http://baked:8080",
}))

import * as SecureStore from "expo-secure-store"

describe("apiSettings (disabled by default)", () => {
  it("API_OVERRIDE_ENABLED is false without env", async () => {
    const mod = await import("../apiSettings")
    expect(mod.API_OVERRIDE_ENABLED).toBe(false)
  })

  it("loadApiOverride returns the baked url without touching the store", async () => {
    const mod = await import("../apiSettings")
    const url = await mod.loadApiOverride()
    expect(url).toBe("http://baked:8080")
    expect(SecureStore.getItemAsync).not.toHaveBeenCalled()
  })

  it("currentApiUrl returns the active url", async () => {
    const mod = await import("../apiSettings")
    expect(mod.currentApiUrl()).toBe("http://baked:8080")
  })
})

describe("apiSettings (enabled)", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_ALLOW_API_OVERRIDE = "1"
    vi.resetModules()
    currentUrl = "http://baked:8080"
    apiMock.setBaseUrl.mockClear()
    apiMock.getBaseUrl.mockClear()
    vi.mocked(SecureStore.getItemAsync).mockReset()
    vi.mocked(SecureStore.setItemAsync).mockReset()
    vi.mocked(SecureStore.deleteItemAsync).mockReset()
  })

  it("API_OVERRIDE_ENABLED is true", async () => {
    const mod = await import("../apiSettings")
    expect(mod.API_OVERRIDE_ENABLED).toBe(true)
  })

  it("loadApiOverride applies a saved override", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue("https://tunnel.example.com")
    const mod = await import("../apiSettings")
    const url = await mod.loadApiOverride()
    expect(url).toBe("https://tunnel.example.com")
    expect(apiMock.setBaseUrl).toHaveBeenCalledWith("https://tunnel.example.com")
  })

  it("loadApiOverride ignores an invalid saved value", async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue("not a url")
    const mod = await import("../apiSettings")
    await mod.loadApiOverride()
    expect(apiMock.setBaseUrl).not.toHaveBeenCalled()
  })

  it("loadApiOverride swallows store errors", async () => {
    vi.mocked(SecureStore.getItemAsync).mockRejectedValue(new Error("keystore broken"))
    const mod = await import("../apiSettings")
    const url = await mod.loadApiOverride()
    expect(url).toBe("http://baked:8080")
  })

  it("saveApiOverride validates, persists and applies", async () => {
    const mod = await import("../apiSettings")
    const url = await mod.saveApiOverride("https://new.example.com/")
    expect(url).toBe("https://new.example.com")
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("amanak.apiBaseUrl", "https://new.example.com")
    expect(apiMock.setBaseUrl).toHaveBeenCalledWith("https://new.example.com")
  })

  it("saveApiOverride throws on invalid input", async () => {
    const mod = await import("../apiSettings")
    await expect(mod.saveApiOverride("nope")).rejects.toThrow(/http/i)
  })

  it("clearApiOverride removes and resets to the baked url", async () => {
    const mod = await import("../apiSettings")
    const url = await mod.clearApiOverride()
    expect(url).toBe("http://baked:8080")
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("amanak.apiBaseUrl")
    expect(apiMock.setBaseUrl).toHaveBeenCalledWith("http://baked:8080")
  })
})