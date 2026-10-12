import { useCallback } from "react"
import { useTheme } from "../ThemeProvider"
import type { Locale } from "../tokens"
import { ar } from "./ar"
import { en } from "./en"

export const messages: Record<Locale, Record<string, string>> = { ar, en }

export const locales: Locale[] = ["ar", "en"]

/**
 * Pure translation helper. A missing key returns the key itself so it is
 * immediately visible during development.
 */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const table = messages[locale] ?? messages.en
  let out = table[key] ?? key
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${name}\\}`, "g"), String(value))
    }
  }
  return out
}

/** Translate for the currently selected locale. */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const { locale } = useTheme()
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  )
}
