export const tokens = {
  color: {
    // Primary blue (replaces burnt orange)
    brand: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      600: "#2563eb", // primary
      700: "#1d4ed8", // hover
      800: "#1e40af",
      900: "#1e3a8a",
      gradient: "linear-gradient(135deg, #2563eb, #3b82f6)",
    },
    // Navy (sidebar + dark surfaces)
    navy: {
      700: "#1e293b",
      800: "#0f1b2d", // sidebar background
      900: "#0b1220", // sidebar darker / overlays
      950: "#050a15",
    },
    // Slate neutrals
    neutral: {
      0: "#ffffff",
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e5eaf2", // borders
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b", // muted text
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#172033", // primary text
      950: "#0f172a",
    },
    // Semantic (unchanged names, refined values)
    success: { light: "#059669", dark: "#34d399" },
    warning: { light: "#d97706", dark: "#fbbf24" },
    danger: { light: "#dc2626", dark: "#f87171" },
    info: { light: "#2563eb", dark: "#60a5fa" },
    purple: { light: "#7c3aed", dark: "#a78bfa" },
    // Severity (used by scanner/breach UIs)
    severity: {
      low: { light: "#2563eb", dark: "#60a5fa" },
      medium: { light: "#d97706", dark: "#fbbf24" },
      high: { light: "#ea580c", dark: "#fb923c" },
      critical: { light: "#dc2626", dark: "#f87171" },
    },
    // Overlay backdrops
    overlay: {
      dark: "rgba(15, 27, 45, 0.5)",
      light: "rgba(255, 255, 255, 0.8)",
    },
    // Focus ring colour (brand-600 in light, brand-500 in dark)
    focus: { light: "#2563eb", dark: "#3b82f6" },
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
  ring: "0 0 0 3px rgba(37,99,235,0.15)",
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
