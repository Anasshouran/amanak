import { useMemo } from "react"
import { useTheme } from "./ThemeProvider"

/**
 * Mobile design tokens.
 *
 * Mirrors `apps/web/src/design/tokens.ts` value-for-value so the two clients
 * cannot drift: brand blue, navy sidebar, slate neutrals, semantic colours,
 * severity ramp, spacing, radii, type scale, weights and motion all match the
 * web reference exactly.
 */
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

/**
 * Theme-resolved semantic colours.
 *
 * These are the `--c-*` custom properties from `apps/web/src/design/global.css`,
 * lifted 1:1 so a card looks the same on both clients.
 */
export type SemanticColors = {
  bg: string
  surface: string
  surface2: string
  elevated: string
  text: string
  textStrong: string
  muted: string
  border: string
  borderStrong: string
  brand: string
  brandStrong: string
  brandContrast: string
  danger: string
  success: string
  warning: string
  info: string
  sevLow: string
  sevMedium: string
  sevHigh: string
  sevCritical: string
  focus: string
  overlay: string
  hover: string
  sidebarBg: string
  sidebarText: string
  sidebarActiveBg: string
  sidebarActiveText: string
}

export const semantic: Record<Theme, SemanticColors> = {
  light: {
    bg: "#f5f7fb",
    surface: "#ffffff",
    surface2: "#f8fafc",
    elevated: "#ffffff",
    text: "#172033",
    textStrong: "#0f172a",
    muted: "#64748b",
    border: "#e5eaf2",
    borderStrong: "#cbd5e1",
    brand: "#2563eb",
    brandStrong: "#1d4ed8",
    brandContrast: "#ffffff",
    danger: "#dc2626",
    success: "#047857",
    warning: "#b45309",
    info: "#2563eb",
    sevLow: "#2563eb",
    sevMedium: "#d97706",
    sevHigh: "#ea580c",
    sevCritical: "#dc2626",
    focus: "#2563eb",
    overlay: "rgba(15, 27, 45, 0.5)",
    hover: "rgba(15, 23, 42, 0.04)",
    sidebarBg: "#0f1b2d",
    sidebarText: "#cbd5e1",
    sidebarActiveBg: "#2563eb",
    sidebarActiveText: "#ffffff",
  },
  dark: {
    bg: "#0b1220",
    surface: "#0f1b2d",
    surface2: "#131c2e",
    elevated: "#16223a",
    text: "#e2e8f0",
    textStrong: "#f8fafc",
    muted: "#94a3b8",
    border: "#1e293b",
    borderStrong: "#334155",
    brand: "#3b82f6",
    brandStrong: "#2563eb",
    brandContrast: "#ffffff",
    danger: "#f87171",
    success: "#34d399",
    warning: "#fbbf24",
    info: "#60a5fa",
    sevLow: "#60a5fa",
    sevMedium: "#fbbf24",
    sevHigh: "#fb923c",
    sevCritical: "#f87171",
    focus: "#3b82f6",
    overlay: "rgba(15, 27, 45, 0.5)",
    hover: "rgba(148, 163, 184, 0.08)",
    sidebarBg: "#050a15",
    sidebarText: "#cbd5e1",
    sidebarActiveBg: "#2563eb",
    sidebarActiveText: "#ffffff",
  },
}

/** Static scales plus the semantic colours for the active theme. */
export type ActiveTokens = Tokens & { c: SemanticColors }

/**
 * The active theme's token values.
 *
 * Import stays one-directional (tokens → ThemeProvider) because ThemeProvider
 * only needs `type` imports from this file, which are erased at compile time.
 */
export function useTokens(): ActiveTokens {
  const { theme } = useTheme()
  return useMemo(() => ({ ...tokens, c: semantic[theme] }), [theme])
}
