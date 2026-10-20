export interface DeviceInfo {
  browser: string
  os: string
  type: "desktop" | "mobile" | "tablet" | "unknown"
}

export function parseUserAgent(ua: string): DeviceInfo {
  const s = ua || ""

  // Browser
  let browser = "Unknown"
  if (/Edg\//.test(s)) browser = "Edge"
  else if (/Chrome\//.test(s) && !/Edg\//.test(s)) browser = "Chrome"
  else if (/Firefox\//.test(s)) browser = "Firefox"
  else if (/Safari\//.test(s) && !/Chrome\//.test(s)) browser = "Safari"

  // OS
  let os = "Unknown"
  if (/Windows NT/.test(s)) os = "Windows"
  else if (/Mac OS X/.test(s) && !/iPhone|iPad|iPod/.test(s)) os = "macOS"
  else if (/iPhone|iPad|iPod/.test(s)) os = "iOS"
  else if (/Android/.test(s)) os = "Android"
  else if (/Linux/.test(s)) os = "Linux"

  // Type
  let type: DeviceInfo["type"] = "unknown"
  if (/Mobile|iPhone|Android.*Mobile/.test(s)) type = "mobile"
  else if (/iPad|Tablet/.test(s)) type = "tablet"
  else if (os !== "Unknown") type = "desktop"

  return { browser, os, type }
}

export function formatDevice(ua: string, locale: "ar" | "en"): string {
  const { browser, os } = parseUserAgent(ua)
  if (browser === "Unknown" && os === "Unknown") {
    // Already a short label from the backend (or unparseable) — show as-is.
    return ua || (locale === "ar" ? "جهاز غير معروف" : "Unknown device")
  }
  const b = browser === "Unknown" ? (locale === "ar" ? "متصفح غير معروف" : "Unknown browser") : browser
  const o = os === "Unknown" ? (locale === "ar" ? "نظام غير معروف" : "Unknown OS") : os
  return locale === "ar" ? `${b} على ${o}` : `${b} on ${o}`
}

export function deviceTypeFromLabel(label: string): DeviceInfo["type"] {
  const s = label || ""
  if (/Mobile|iPhone|Android.*Mobile/i.test(s)) return "mobile"
  if (/iPad|Tablet/i.test(s)) return "tablet"
  if (/Windows|Mac|Linux|Android|iOS/i.test(s)) return "desktop"
  return "unknown"
}
