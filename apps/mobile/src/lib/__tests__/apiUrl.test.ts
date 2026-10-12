import { describe, it, expect, vi } from "vitest"

vi.mock("react-native", () => ({ Platform: { OS: "ios", isTV: false } }))

import { pickApiUrl, resolveApiUrl } from "../apiUrl"

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
