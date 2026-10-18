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
import { I18nManager } from "react-native"
import { translate } from "./i18n"
import type { Locale } from "./tokens"
import { loadStore, readStoreSync, writeStore } from "./storage"

const LOCALE_KEY = "amanak.locale"

type LocaleContextValue = {
  locale: Locale
  /** True when the UI must lay out right-to-left. */
  isRTL: boolean
  setLocale: (locale: Locale) => void
  toggleLocale: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined)

function initialLocale(): Locale {
  const stored = readStoreSync(LOCALE_KEY)
  if (stored === "ar" || stored === "en") return stored
  // Arabic is the product default, matching the web client.
  return "ar"
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)
  const hydrated = useRef(readStoreSync(LOCALE_KEY) !== null)
  const isRTL = locale === "ar"

  useEffect(() => {
    if (hydrated.current) return
    let cancelled = false
    void loadStore(LOCALE_KEY).then((value) => {
      if (cancelled || hydrated.current) return
      hydrated.current = true
      if (value === "ar" || value === "en") setLocaleState(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void writeStore(LOCALE_KEY, locale)

    // react-native-web ships a no-op `forceRTL`, so the DOM direction is set
    // explicitly for web; on device the native flag applies after a reload.
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", locale)
      document.documentElement.setAttribute("dir", isRTL ? "rtl" : "ltr")
    }
    if (I18nManager.isRTL !== isRTL) {
      try {
        I18nManager.allowRTL(isRTL)
        I18nManager.forceRTL(isRTL)
      } catch {
        /* I18nManager unavailable outside a native host */
      }
    }
  }, [locale, isRTL])

  const setLocale = useCallback((next: Locale) => setLocaleState(next), [])
  const toggleLocale = useCallback(
    () => setLocaleState((current) => (current === "ar" ? "en" : "ar")),
    [],
  )
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  )

  const value = useMemo(
    () => ({ locale, isRTL, setLocale, toggleLocale, t }),
    [locale, isRTL, setLocale, toggleLocale, t],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider")
  return ctx
}

/** Translate using the active locale. */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  return useLocale().t
}
