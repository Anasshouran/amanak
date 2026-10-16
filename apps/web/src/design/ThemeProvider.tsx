import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Locale, Theme } from "./tokens"

const THEME_KEY = "amanak.theme"
const LOCALE_KEY = "amanak.locale"

type ThemeContextValue = {
  theme: Theme
  locale: Locale
  setTheme: (t: Theme) => void
  setLocale: (l: Locale) => void
  toggleTheme: () => void
  toggleLocale: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function readTheme(): Theme {
  if (typeof localStorage === "undefined") return "light"
  const v = localStorage.getItem(THEME_KEY)
  return v === "light" || v === "dark" ? v : "light"
}

function readLocale(): Locale {
  if (typeof localStorage === "undefined") return "ar"
  const v = localStorage.getItem(LOCALE_KEY)
  return v === "ar" || v === "en" ? v : "ar"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme)
  const [locale, setLocaleState] = useState<Locale>(readLocale)

  useEffect(() => {
    const el = document.documentElement
    el.setAttribute("data-theme", theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* storage unavailable */
    }
  }, [theme])

  useEffect(() => {
    const el = document.documentElement
    el.setAttribute("lang", locale)
    el.setAttribute("dir", locale === "ar" ? "rtl" : "ltr")
    try {
      localStorage.setItem(LOCALE_KEY, locale)
    } catch {
      /* storage unavailable */
    }
  }, [locale])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const setLocale = useCallback((l: Locale) => setLocaleState(l), [])
  const toggleTheme = useCallback(
    () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
    [],
  )
  const toggleLocale = useCallback(
    () => setLocaleState((l) => (l === "ar" ? "en" : "ar")),
    [],
  )

  const value = useMemo(
    () => ({ theme, locale, setTheme, setLocale, toggleTheme, toggleLocale }),
    [theme, locale, setTheme, setLocale, toggleTheme, toggleLocale],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
