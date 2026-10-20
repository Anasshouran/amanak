import type { DeviceInfo } from "../../lib/deviceName"

export function DeviceIcon({ type, size = 20 }: { type: DeviceInfo["type"]; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }
  if (type === "mobile") {
    return (
      <svg {...common}>
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <line x1="12" y1="18" x2="12" y2="18" />
      </svg>
    )
  }
  if (type === "tablet") {
    return (
      <svg {...common}>
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <line x1="12" y1="18" x2="12" y2="18" />
      </svg>
    )
  }
  if (type === "desktop") {
    return (
      <svg {...common}>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 9h.01M15 9h.01M9 15h6" />
    </svg>
  )
}
