import { describe, it, expect, vi } from "vitest"

vi.mock("react-native", () => ({ Platform: { OS: "ios", isTV: false } }))

import { pickApiUrl, resolveApiUrl, normalizeApiUrl } from "../apiUrl"

describe("pickApiUrl", () => {
  it("returns the env var when set", () => {
    expect(pickApiUrl("android", "http://192.168.1.5:8080")).toBe("http://192.168.1.5:8080")
  })

  it("returns 10.0.2.2 on Android", () => {
    expect(pickApiUrl("android")).toBe("http://10.0.2.2:8080")
  })

  it("returns 127.0.0.1 on iOS", () => {
    expect(pickApiUrl("ios")).toBe("http://127.0.0.1:8080")
  })

  it("returns 127.0.0.1 on web", () => {
    expect(pickApiUrl("web")).toBe("http://127.0.0.1:8080")
  })

  it("throws on a native platform with no env var", () => {
    expect(() => pickApiUrl("native")).toThrow(/EXPO_PUBLIC_API_URL/)
  })
})

describe("resolveApiUrl", () => {
  it("uses the runtime platform", () => {
    expect(resolveApiUrl()).toBe("http://127.0.0.1:8080")
  })
})

describe("normalizeApiUrl", () => {
  it("accepts a plain https origin", () => {
    expect(normalizeApiUrl("https://api.example.com")).toBe("https://api.example.com")
  })
  it("trims whitespace and trailing slashes", () => {
    expect(normalizeApiUrl("  https://api.example.com///  ")).toBe("https://api.example.com")
  })
  it("keeps an explicit port", () => {
    expect(normalizeApiUrl("http://192.168.1.5:8080")).toBe("http://192.168.1.5:8080")
  })
  it("keeps a path prefix", () => {
    expect(normalizeApiUrl("https://example.com/api")).toBe("https://example.com/api")
  })
  it("rejects empty / whitespace", () => {
    expect(normalizeApiUrl("   ")).toBeNull()
    expect(normalizeApiUrl("")).toBeNull()
  })
  it("rejects values without a scheme", () => {
    expect(normalizeApiUrl("api.example.com")).toBeNull()
  })
  it("rejects out-of-range ports", () => {
    expect(normalizeApiUrl("https://example.com:99999")).toBeNull()
  })
  it("rejects embedded credentials", () => {
    expect(normalizeApiUrl("https://user:pass@example.com")).toBeNull()
  })
  it("rejects spaces inside the URL", () => {
    expect(normalizeApiUrl("https://ex ample.com")).toBeNull()
  })
})
