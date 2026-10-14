import type { ComponentType } from "react"
import { NavLink } from "react-router-dom"
import { useT } from "../i18n"
import {
  IconAccounts,
  IconAI,
  IconAwareness,
  IconDashboard,
  IconDevices,
  IconFamily,
  IconIncidents,
  IconKey,
  IconPasswords,
  IconPlans,
  IconScanner,
  IconSettings,
  IconShield,
} from "../icons"

type NavEntry = {
  to: string
  key: string
  icon: ComponentType<{ size?: number }>
  end?: boolean
}

const LINKS: NavEntry[] = [
  { to: "/", key: "nav.dashboard", icon: IconDashboard, end: true },
  { to: "/scanner", key: "nav.scanner", icon: IconScanner },
  { to: "/breach", key: "nav.breach", icon: IconShield },
  { to: "/family", key: "nav.family", icon: IconFamily },
  { to: "/accounts", key: "nav.accounts", icon: IconAccounts },
  { to: "/devices", key: "nav.devices", icon: IconDevices },
  { to: "/incidents", key: "nav.incidents", icon: IconIncidents },
  { to: "/ai", key: "nav.ai", icon: IconAI },
  { to: "/vault", key: "nav.2fa", icon: IconKey },
  { to: "/passwords", key: "nav.passwords", icon: IconPasswords },
  { to: "/awareness", key: "nav.awareness", icon: IconAwareness },
  { to: "/settings", key: "nav.settings", icon: IconSettings },
  { to: "/plans", key: "nav.plans", icon: IconPlans },
]

function linkClass({ isActive }: { isActive: boolean }): string {
  return `amk-navlink${isActive ? " is-active" : ""}`
}

export function Nav() {
  const t = useT()
  return (
    <>
      <aside className="amk-sidebar" aria-label={t("common.menu")}>
        {LINKS.map(({ to, key, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            <Icon size={18} />
            <span>{t(key)}</span>
          </NavLink>
        ))}
      </aside>
      <nav className="amk-bottomnav" aria-label={t("common.menu")}>
        {LINKS.map(({ to, key, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            <Icon size={20} />
            <span>{t(key)}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
