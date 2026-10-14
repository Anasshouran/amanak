import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { useT } from "../i18n"
import { IconGlobe, IconLogout, IconMoon, IconSun } from "../icons"
import { useTheme } from "../ThemeProvider"
import { Button } from "./Button"

export type HeaderProps = {
  email?: string
  onSignOut?: () => void
  /** App-provided widget (e.g. the notifications bell) kept out of the design layer. */
  notifications?: ReactNode
}

export function Header({ email, onSignOut, notifications }: HeaderProps) {
  const { theme, locale, toggleTheme, toggleLocale } = useTheme()
  const t = useT()

  return (
    <header className="amk-header">
      <Link to="/dashboard" className="amk-brand-mark" aria-label={t("brand.name")}>
        <span className="amk-brand-mark__dot" aria-hidden="true" />
        <span>{t("brand.name")}</span>
      </Link>
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
        {email && (
          <span className="amk-user">
            <span className="sr-only">{t("common.user")}</span>
            {email}
          </span>
        )}
        {onSignOut && (
          <Button variant="ghost" size="sm" icon={<IconLogout size={16} />} onClick={onSignOut}>
            {t("actions.signOut")}
          </Button>
        )}
      </div>
    </header>
  )
}
