import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link, useLocation } from "react-router-dom"
import { useT } from "../i18n"
import { IconChevron, IconGlobe, IconLogout, IconMoon, IconSearch, IconSun } from "../icons"
import { useTheme } from "../ThemeProvider"

export type HeaderProps = {
  user?: { email: string; username?: string }
  onSignOut?: () => void
  /** App-provided widget (e.g. the notifications bell) kept out of the design layer. */
  notifications?: ReactNode
}

/** Route prefix → i18n key used for the contextual page title. */
const TITLES: Array<[string, string]> = [
  ["/dashboard", "nav.dashboard"],
  ["/scanner", "nav.scanner"],
  ["/breach", "nav.breach"],
  ["/devices", "nav.devices"],
  ["/accounts", "nav.accounts"],
  ["/incidents", "nav.incidents"],
  ["/ai", "nav.ai"],
  ["/vault", "nav.2fa"],
  ["/passwords", "nav.passwords"],
  ["/family", "nav.family"],
  ["/awareness", "nav.awareness"],
  ["/billing", "nav.billing"],
  ["/plans", "nav.plans"],
  ["/notifications", "nav.notifications"],
  ["/staff", "nav.staff"],
  ["/settings", "nav.settings"],
]

function initialsOf(value: string): string {
  const parts = value.trim().split(/[\s@._-]+/).filter(Boolean)
  const first = parts[0]?.[0] ?? "?"
  const second = parts[1]?.[0] ?? ""
  return (first + second).toUpperCase()
}

export function Header({ user, onSignOut, notifications }: HeaderProps) {
  const { theme, locale, toggleTheme, toggleLocale } = useTheme()
  const t = useT()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDocClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [menuOpen])

  const titleKey = TITLES.find(([prefix]) => location.pathname.startsWith(prefix))?.[1]
  const name = user?.username || user?.email || ""

  return (
    <header className="amk-header">
      <div className="amk-header__title">
        {titleKey && <strong>{t(titleKey)}</strong>}
        <span className="amk-header__crumbs">AMANAK</span>
      </div>

      <form className="amk-search" role="search" onSubmit={(e) => e.preventDefault()}>
        <span className="amk-search__icon" aria-hidden="true">
          <IconSearch size={18} />
        </span>
        <input
          type="search"
          className="amk-search__input"
          aria-label={t("header.searchLabel")}
          placeholder={t("header.search")}
        />
      </form>

      <div className="amk-header__spacer" />

      <div className="amk-header__actions">
        {notifications}
        <button
          type="button"
          className="amk-iconbtn"
          onClick={toggleTheme}
          aria-label={t("theme.toggle")}
          title={theme === "dark" ? t("theme.light") : t("theme.dark")}
        >
          {theme === "dark" ? <IconSun /> : <IconMoon />}
        </button>
        <button
          type="button"
          className="amk-iconbtn"
          onClick={toggleLocale}
          aria-label={t("locale.toggle")}
          title={locale === "ar" ? "English" : "العربية"}
        >
          <IconGlobe />
        </button>

        {onSignOut && (
          <button
            type="button"
            className="amk-iconbtn"
            onClick={onSignOut}
            aria-label={t("actions.signOut")}
            title={t("actions.signOut")}
          >
            <IconLogout />
          </button>
        )}

        {user && (
          <div className="amk-usermenu" ref={menuRef}>
            <button
              type="button"
              className="amk-usermenu__trigger"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t("user.menu")}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="amk-avatar" aria-hidden="true">
                {initialsOf(name || user.email)}
              </span>
              <span className="amk-usermenu__name">
                <strong>{name}</strong>
                <span>{user.email}</span>
              </span>
              <IconChevron size={16} />
            </button>
            {menuOpen && (
              <div className="amk-usermenu__panel" role="menu">
                <Link
                  className="amk-menu-item"
                  to="/settings"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                >
                  {t("user.profile")}
                </Link>
                <Link
                  className="amk-menu-item"
                  to="/settings"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                >
                  {t("nav.settings")}
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
