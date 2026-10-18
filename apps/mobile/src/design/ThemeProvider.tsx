import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useColorScheme } from "react-native"
import type { Theme } from "./tokens"
import { loadStore, readStoreSync, writeStore } from "./storage"

const THEME_KEY = "amanak.theme"

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function initialTheme(system: string | null | undefined): Theme {
  // On web the preference is read synchronously so there is no light/dark
  // flash; on device the async keystore value lands in the hydration effect.
  const stored = readStoreSync(THEME_KEY)
  if (stored === "light" || stored === "dark") return stored
  return system === "light" ? "light" : "dark"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme()
  const [theme, setThemeState] = useState<Theme>(() => initialTheme(system))
  const hydrated = useRef(readStoreSync(THEME_KEY) !== null)

  useEffect(() => {
    if (hydrated.current) return
    let cancelled = false
    void loadStore(THEME_KEY).then((value) => {
      if (cancelled || hydrated.current) return
      hydrated.current = true
      if (value === "light" || value === "dark") setThemeState(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void writeStore(THEME_KEY, theme)
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme)
    }
  }, [theme])

  const setTheme = useCallback((next: Theme) => setThemeState(next), [])
  const toggleTheme = useCallback(
    () => setThemeState((current) => (current === "dark" ? "light" : "dark")),
    [],
  )

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
