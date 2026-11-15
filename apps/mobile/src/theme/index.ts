/**
 * AMANAK mobile design theme — Dark Theme Mockup reference.
 *
 * Single source of truth for the visual identity used by the redesigned
 * screens (dashboard, tab bar, vault, scanner, AI). Values mirror the mockup
 * the user supplied: deep navy background, green glow accent, blue primary.
 *
 * Existing screens still consume `src/design/tokens.ts`; migrate them
 * incrementally. New code should prefer this module.
 */

export const theme = {
  color: {
    bg: "#0B1E3A",
    bgDeep: "#050a15",
    surface: "rgba(255,255,255,0.06)",
    surfaceStrong: "rgba(255,255,255,0.10)",
    border: "rgba(255,255,255,0.12)",
    text: "#E2E8F0",
    textMuted: "#94A3B8",
    textStrong: "#FFFFFF",
    primary: "#1D4ED8",
    primaryLight: "#3B82F6",
    glow: "#2ECC71",
    glowSoft: "rgba(46,204,113,0.25)",
    danger: "#F87171",
    warning: "#FBBF24",
  },
  gradient: {
    card: ["#1E3A8A", "#0B1E3A"] as const,
    cardAlt: ["#0F172A", "#1E293B"] as const,
    accent: ["#1D4ED8", "#3B82F6"] as const,
    glow: ["#2ECC71", "#10B981"] as const,
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 },
  font: {
    family: "Cairo",
    size: { xs: 11, sm: 13, md: 15, lg: 18, xl: 22, xxl: 28, display: 40 },
    weight: { regular: "400", medium: "600", bold: "700" } as const,
  },
} as const

export type Theme = typeof theme
export default theme
