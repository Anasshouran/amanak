import { useEffect, useRef, useState } from "react"
import type { ComponentType, ReactNode } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { useT } from "../i18n"
import {
  IconAccounts,
  IconAI,
  IconAwareness,
  IconAudit,
  IconChevron,
  IconDashboard,
  IconDevices,
  IconFamily,
  IconIncidents,
  IconKey,
  IconMetrics,
  IconPasswords,
  IconPlans,
  IconScanner,
  IconSettings,
  IconShield,
  IconStaff,
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

const LINKS: NavEntry[] = [
  { to: "/dashboard", key: "nav.dashboard", icon: IconDashboard, end: true },
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

/** localStorage key holding whether the staff section is collapsed. */
export const STAFF_SECTION_STORAGE_KEY = "nav.staff.collapsed"

function linkClass({ isActive }: { isActive: boolean }): string {
  return `amk-navlink${isActive ? " is-active" : ""}`
}

function NavSubItem({
  to,
  icon: Icon,
  end,
  badge,
  badgeLabel,
  size = 18,
  onNavigate,
  children,
}: {
  to: string
  icon: ComponentType<{ size?: number }>
  end?: boolean
  badge?: number
  badgeLabel?: string
  size?: number
  onNavigate?: () => void
  children: ReactNode
}) {
  return (
    <NavLink to={to} end={end} className={linkClass} onClick={onNavigate}>
      <Icon size={size} />
      <span>{children}</span>
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

function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const panel = ref.current
    const focusable = () =>
      Array.from(panel?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [])

    focusable()[0]?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== "Tab") return
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (event.shiftKey && (active === first || !panel?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return ref
}

function StaffDrawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const t = useT()
  const ref = useFocusTrap(open, onClose)

  if (!open) return null

  return (
    <>
      <div className="amk-drawer-scrim" onClick={onClose} aria-hidden="true" />
      <div className="amk-drawer" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="amk-drawer__head">
          <span className="amk-drawer__title">{title}</span>
          <button
            type="button"
            className="amk-drawer__close"
            aria-label={t("actions.close")}
            onClick={onClose}
          >
            <IconChevron size={18} />
          </button>
        </div>
        <div className="amk-drawer__items">{children}</div>
      </div>
    </>
  )
}

export function Nav({
  staff = false,
  roles = [],
  openTickets = 0,
}: {
  staff?: boolean
  roles?: string[]
  openTickets?: number
}) {
  const t = useT()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const has = (...allowed: string[]) =>
    roles.includes("super_admin") || allowed.some((role) => roles.includes(role))

  const badgeLabel = t("staff.nav.ticketsBadge", { count: openTickets })
  const closeDrawer = () => setDrawerOpen(false)

  const staffItems = staff ? (
    <>
      <NavSubItem to="/staff" end icon={IconStaffHome} onNavigate={closeDrawer}>
        {t("staff.nav.home")}
      </NavSubItem>
      {has("support", "security_admin") && (
        <NavSubItem to="/staff/users" icon={IconUsers} onNavigate={closeDrawer}>
          {t("staff.nav.users")}
        </NavSubItem>
      )}
      {has("support") && (
        <NavSubItem
          to="/staff/tickets"
          icon={IconTicket}
          badge={openTickets}
          badgeLabel={badgeLabel}
          onNavigate={closeDrawer}
        >
          {t("staff.nav.tickets")}
        </NavSubItem>
      )}
      {has("security_admin") && (
        <NavSubItem to="/staff/audit" icon={IconAudit} onNavigate={closeDrawer}>
          {t("staff.nav.audit")}
        </NavSubItem>
      )}
      <NavSubItem to="/staff/metrics" icon={IconMetrics} onNavigate={closeDrawer}>
        {t("staff.nav.metrics")}
      </NavSubItem>
      {has("billing_admin") && (
        <NavSubItem to="/staff/subscriptions" icon={IconSubscription} onNavigate={closeDrawer}>
          {t("staff.nav.subscriptions")}
        </NavSubItem>
      )}
      {has("super_admin") && (
        <NavSubItem to="/staff/announcements" icon={IconAnnouncement} onNavigate={closeDrawer}>
          {t("staff.nav.announcements")}
        </NavSubItem>
      )}
    </>
  ) : null

  const onStaffRoute = location.pathname.startsWith("/staff")

  return (
    <>
      <aside className="amk-sidebar" aria-label={t("common.menu")}>
        {LINKS.map(({ to, key, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            <Icon size={18} />
            <span>{t(key)}</span>
          </NavLink>
        ))}
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
      </aside>

      <nav className="amk-bottomnav" aria-label={t("common.menu")}>
        {LINKS.map(({ to, key, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            <Icon size={20} />
            <span>{t(key)}</span>
          </NavLink>
        ))}
        {staff && (
          <button
            type="button"
            className={`amk-navlink amk-navbutton${onStaffRoute ? " is-active" : ""}`}
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <IconStaff size={20} />
            <span>{t("staff.nav")}</span>
          </button>
        )}
      </nav>

      {staff && (
        <StaffDrawer open={drawerOpen} title={t("staff.nav.menu")} onClose={closeDrawer}>
          {staffItems}
        </StaffDrawer>
      )}
    </>
  )
}
