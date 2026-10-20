import { describe, expect, it } from "vitest"
import { formatDevice, parseUserAgent } from "../deviceName"

describe("parseUserAgent", () => {
  it("Chrome on Linux desktop", () => {
    const ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    expect(parseUserAgent(ua)).toEqual({ browser: "Chrome", os: "Linux", type: "desktop" })
  })

  it("Safari on macOS desktop", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
    expect(parseUserAgent(ua)).toEqual({ browser: "Safari", os: "macOS", type: "desktop" })
  })

  it("Firefox on Windows desktop", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"
    expect(parseUserAgent(ua)).toEqual({ browser: "Firefox", os: "Windows", type: "desktop" })
  })

  it("Safari on iPhone mobile", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    expect(parseUserAgent(ua)).toEqual({ browser: "Safari", os: "iOS", type: "mobile" })
  })

  it("Chrome on Android mobile", () => {
    const ua = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    expect(parseUserAgent(ua)).toEqual({ browser: "Chrome", os: "Android", type: "mobile" })
  })

  it("Unknown UA", () => {
    expect(parseUserAgent("")).toEqual({ browser: "Unknown", os: "Unknown", type: "unknown" })
  })
})

describe("formatDevice", () => {
  it("formats in English", () => {
    const ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    expect(formatDevice(ua, "en")).toBe("Chrome on Linux")
  })

  it("formats in Arabic", () => {
    const ua = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    expect(formatDevice(ua, "ar")).toBe("Chrome على Linux")
  })
})
