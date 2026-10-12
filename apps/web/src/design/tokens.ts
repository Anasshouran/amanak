export const tokens = {
  color: {
    // Brand — burnt orange
    brand: {
      50: "#fff7ed",
      100: "#ffedd5",
      200: "#fed7aa",
      300: "#fdba74",
      400: "#fb923c",
      500: "#f97316",
      600: "#ea580c", // primary
      700: "#c2410c",
      800: "#9a3412",
      900: "#7c2d12",
    },
    // Neutral scale (10 steps)
    neutral: {
      0: "#ffffff",
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
      950: "#020617",
    },
    // Semantic
    success: { light: "#10b981", dark: "#34d399" },
    warning: { light: "#f59e0b", dark: "#fbbf24" },
    danger: { light: "#dc2626", dark: "#f87171" },
    info: { light: "#0ea5e9", dark: "#38bdf8" },
    // Severity (used by scanner/breach UIs)
    severity: {
      low: { light: "#0ea5e9", dark: "#38bdf8" },
      medium: { light: "#f59e0b", dark: "#fbbf24" },
      high: { light: "#ea580c", dark: "#fb923c" },
      critical: { light: "#dc2626", dark: "#f87171" },
    },
  },
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 },
  radius: { sm: 6, md: 10, lg: 14, xl: 20, full: 9999 },
  font: {
    ar: '"IBM Plex Sans Arabic", "Segoe UI", system-ui, sans-serif',
    en: '"Inter", "Segoe UI", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  },
  size: {
    xs: 12,
    sm: 13,
    base: 14,
    md: 15,
    lg: 18,
    xl: 22,
    "2xl": 28,
    "3xl": 36,
    "4xl": 48,
  },
  shadow: {
    none: "none",
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 12px rgba(0,0,0,0.08)",
    lg: "0 12px 32px rgba(0,0,0,0.12)",
  },
  motion: {
    fast: "120ms ease",
    base: "180ms ease",
    slow: "280ms ease",
  },
} as const

export type Tokens = typeof tokens
export type Theme = "light" | "dark"
export type Locale = "ar" | "en"
