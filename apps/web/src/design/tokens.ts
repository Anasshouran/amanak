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
      gradient: "linear-gradient(135deg, #ea580c, #f97316)",
    },
    // Neutral scale (10 steps) — 900/950 slightly bluer for the dark theme
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
      900: "#0b1220",
      950: "#050a15",
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
    // Overlay backdrops
    overlay: {
      dark: "rgba(2, 6, 23, 0.6)",
      light: "rgba(255, 255, 255, 0.8)",
    },
    // Focus ring colour (brand-500 in light, brand-400 in dark)
    focus: { light: "#ea580c", dark: "#fb923c" },
  },
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 },
  radius: { sm: 6, md: 10, lg: 14, xl: 20, full: 9999 },
  font: {
    ar: '"IBM Plex Sans Arabic", "Segoe UI", system-ui, sans-serif',
    en: '"Inter", "Segoe UI", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, monospace',
  },
  fontFeature: '"ss01", "cv01"',
  size: {
    // display (landing only)
    "6xl": 60,
    "5xl": 48,
    "4xl": 36,
    // headings
    "3xl": 30,
    "2xl": 24,
    xl: 20,
    // body
    lg: 18,
    md: 16,
    base: 15,
    sm: 14,
    xs: 13,
    // micro
    "2xs": 12,
  },
  lineHeight: {
    tight: 1.15, // display
    snug: 1.3, // headings
    normal: 1.55, // body
    relaxed: 1.7, // long-form
  },
  letterSpacing: {
    tighter: "-0.03em",
    tight: "-0.01em",
    normal: "0",
    wide: "0.01em",
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  shadow: {
    none: "none",
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 12px rgba(0,0,0,0.08)",
    lg: "0 12px 32px rgba(0,0,0,0.12)",
  },
  ring: "0 0 0 4px rgba(234,88,12,0.15)",
  motion: {
    fast: "120ms cubic-bezier(0.2, 0, 0, 1)",
    base: "200ms cubic-bezier(0.2, 0, 0, 1)",
    slow: "320ms cubic-bezier(0.2, 0, 0, 1)",
    spring: "400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  duration: { fast: 120, base: 200, slow: 320 },
} as const

export type Tokens = typeof tokens
export type Theme = "light" | "dark"
export type Locale = "ar" | "en"
