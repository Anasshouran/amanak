import { useEffect, useRef, useState } from "react"
import type { ComponentType, ReactNode } from "react"
import { Link, NavLink, useNavigate } from "react-router-dom"
import { useT } from "../i18n"
import { Button } from "./Button"
import {
  IconAccounts,
  IconAwareness,
  IconAudit,
  IconBell,
  IconChevron,
  IconDashboard,
  IconDevices,
  IconFamily,
  IconKey,
  IconLogout,
  IconMetrics,
  IconPasswords,
  IconScanner,
  IconSettings,
  IconShield,
  IconSparkles,
  IconStaffHome,
  IconSubscription,
  IconAnnouncement,
  IconTicket,
  IconUsers,
} from "../icons"

type NavEntry = {
  to: string
  key: string
  icon: ComponentType<{ size?: number }>
  end?: boolean
}

/** Group 1 — Personal (P17.1 reference order). */
const PERSONAL_LINKS: NavEntry[] = [
  { to: "/dashboard", key: "nav.dashboard", icon: IconDashboard, end: true },
  { to: "/scanner", key: "nav.scanner", icon: IconScanner },
  { to: "/breach", key: "nav.breach", icon: IconShield },
  { to: "/devices", key: "nav.devices", icon: IconDevices },
  { to: "/accounts", key: "nav.accounts", icon: IconAccounts },
  { to: "/vault", key: "nav.2fa", icon: IconKey },
  { to: "/passwords", key: "nav.passwords", icon: IconPasswords },
  { to: "/family", key: "nav.family", icon: IconFamily },
  { to: "/awareness", key: "nav.awareness", icon: IconAwareness },
  { to: "/billing", key: "nav.billing", icon: IconSubscription },
  { to: "/notifications", key: "nav.notifications", icon: IconBell },
]

/** Group 3 — Bottom. */
const SETTINGS_LINK: NavEntry = { to: "/settings", key: "nav.settings", icon: IconSettings }

/** localStorage key holding whether the staff section is collapsed. */
export const STAFF_SECTION_STORAGE_KEY = "nav.staff.collapsed"

function linkClass({ isActive }: { isActive: boolean }): string {
  return `amk-navlink${isActive ? " is-active" : ""}`
}

function initialsOf(value: string): string {
  const parts = value.trim().split(/[\s@._-]+/).filter(Boolean)
  const first = parts[0]?.[0] ?? "?"
  const second = parts[1]?.[0] ?? ""
  return (first + second).toUpperCase()
}

function NavItem({
  to,
  labelKey,
  icon: Icon,
  end,
  badge,
  badgeLabel,
}: {
  to: string
  labelKey: string
  icon: ComponentType<{ size?: number }>
  end?: boolean
  badge?: number
  badgeLabel?: string
}) {
  const t = useT()
  const label = t(labelKey)
  return (
    <NavLink to={to} end={end} className={linkClass} title={label}>
      <Icon size={18} />
      <span className="amk-navlink__label">{label}</span>
      {badge != null && badge > 0 && (
        <span className="amk-navbadge" aria-label={badgeLabel}>
          {badge}
        </span>
      )}
    </NavLink>
  )
}

function NavSection({
  title,
  collapsible = false,
  defaultOpen = true,
  storageKey,
  children,
}: {
  title: string
  collapsible?: boolean
  defaultOpen?: boolean
  storageKey?: string
  children: ReactNode
}) {
  const t = useT()
  const [open, setOpen] = useState(() => {
    if (!storageKey) return defaultOpen
    try {
      // Absent value means expanded; "true" means the user collapsed it.
      return window.localStorage.getItem(storageKey) !== "true"
    } catch {
      return defaultOpen
    }
  })

  if (!collapsible) {
    return (
      <div className="amk-navsection">
        <p className="amk-navsection__title">{title}</p>
        {children}
      </div>
    )
  }

  const toggle = () => {
    setOpen((value) => {
      const next = !value
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, next ? "false" : "true")
        } catch {
          /* Storage may be unavailable (private mode); state still works. */
        }
      }
      return next
    })
  }

  return (
    <div className="amk-navsection">
      <button
        type="button"
        className="amk-navsection__toggle"
        aria-expanded={open}
        aria-label={open ? t("nav.staff.collapse") : t("nav.staff.expand")}
        onClick={toggle}
      >
        <span>{title}</span>
        <IconChevron size={16} />
      </button>
      {open && <div className="amk-navsection__items">{children}</div>}
    </div>
  )
}

function UserArea({
  name,
  email,
  onSignOut,
}: {
  name: string
  email: string
  onSignOut?: () => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  return (
    <div className="amk-sidebar__user" ref={ref}>
      <button
        type="button"
        className="amk-userbtn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("user.menu")}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="amk-avatar" aria-hidden="true">
          {initialsOf(name || email)}
        </span>
        <span className="amk-userbtn__meta">
          <strong>{name}</strong>
          <span>{email}</span>
        </span>
        <IconChevron size={16} />
      </button>
      {open && (
        <div className="amk-usermenu__panel" role="menu">
          <Link className="amk-menu-item" to="/settings" role="menuitem" onClick={() => setOpen(false)}>
            {t("user.profile")}
          </Link>
          <Link className="amk-menu-item" to="/settings" role="menuitem" onClick={() => setOpen(false)}>
            {t("nav.settings")}
          </Link>
          {onSignOut && (
            <button
              type="button"
              className="amk-menu-item amk-menu-item--danger"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onSignOut()
              }}
            >
              <IconLogout size={16} />
              {t("actions.signOut")}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function Nav({
  staff = false,
  roles = [],
  openTickets = 0,
  user,
  onSignOut,
  showUpgrade = true,
  inOrgContext = false,
  orgRole = null,
}: {
  staff?: boolean
  roles?: string[]
  openTickets?: number
  user?: { email: string; username?: string }
  onSignOut?: () => void
  showUpgrade?: boolean
  /** Render the "Organization" entry when an org context is active (P18.1c2). */
  inOrgContext?: boolean
  orgRole?: string | null
}) {
  const t = useT()
  const navigate = useNavigate()

  const has = (...allowed: string[]) =>
    roles.includes("super_admin") || allowed.some((role) => roles.includes(role))

  const badgeLabel = t("staff.nav.ticketsBadge", { count: openTickets })

  const staffItems = staff ? (
    <>
      <NavItem to="/staff" labelKey="staff.nav.home" icon={IconStaffHome} end />
      {has("support", "security_admin") && (
        <NavItem to="/staff/users" labelKey="staff.nav.users" icon={IconUsers} />
      )}
      {has("support") && (
        <NavItem
          to="/staff/tickets"
          labelKey="staff.nav.tickets"
          icon={IconTicket}
          badge={openTickets}
          badgeLabel={badgeLabel}
        />
      )}
      {has("security_admin") && (
        <NavItem to="/staff/audit" labelKey="staff.nav.audit" icon={IconAudit} />
      )}
      <NavItem to="/staff/metrics" labelKey="staff.nav.metrics" icon={IconMetrics} />
      {has("billing_admin") && (
        <NavItem
          to="/staff/subscriptions"
          labelKey="staff.nav.subscriptions"
          icon={IconSubscription}
        />
      )}
      {has("super_admin") && (
        <NavItem
          to="/staff/announcements"
          labelKey="staff.nav.announcements"
          icon={IconAnnouncement}
        />
      )}
    </>
  ) : null

  const name = user?.username || user?.email || t("common.user")

  return (
    <aside
      className="amk-sidebar"
      aria-label={t("common.menu")}
      style={{ background: "var(--c-sidebar-bg)" }}
    >
      <div className="amk-sidebar__brand">
        <span className="amk-sidebar__logo" aria-hidden="true">
          <IconShield size={24} />
        </span>
        <span className="amk-sidebar__brandtext">
          <strong className="amk-sidebar__brandname">AMANAK</strong>
          <span className="amk-sidebar__brandsub">أمانك</span>
        </span>
      </div>

      {showUpgrade && !staff && (
        <div className="nav-upgrade-card">
          <span className="nav-upgrade-icon" aria-hidden="true">
            <IconSparkles size={18} />
          </span>
          <div className="nav-upgrade-text">
            <strong>{t("nav.upgrade.title")}</strong>
            <span>{t("nav.upgrade.subtitle")}</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            fullWidth
            className="btn"
            onClick={() => navigate("/plans")}
          >
            {t("nav.upgrade.action")}
          </Button>
        </div>
      )}

      <div className="amk-sidebar__nav">
        <div className="amk-navgroup">
          {inOrgContext && (
            <NavItem to="/org" labelKey="nav.organization" icon={IconUsers} />
          )}
          {inOrgContext && (orgRole === "owner" || orgRole === "admin" || orgRole === "auditor") && (
            <NavItem to="/org/audit" labelKey="nav.audit_log" icon={IconAudit} />
          )}
          {PERSONAL_LINKS.map(({ to, key, icon, end }) => (
            <NavItem key={to} to={to} labelKey={key} icon={icon} end={end} />
          ))}
        </div>
        {staff && (
          <NavSection
            title={t("nav.staff")}
            collapsible
            defaultOpen
            storageKey={STAFF_SECTION_STORAGE_KEY}
          >
            {staffItems}
          </NavSection>
        )}
      </div>

      <div className="amk-sidebar__bottom">
        <NavItem to="/security" labelKey="nav.security" icon={IconShield} />
        <NavItem to={SETTINGS_LINK.to} labelKey={SETTINGS_LINK.key} icon={SETTINGS_LINK.icon} />
        {user && (
          <UserArea name={name} email={user.email} onSignOut={onSignOut} />
        )}
      </div>
    </aside>
  )
}
