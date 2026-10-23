import { Outlet, useLocation } from "react-router-dom"
import { Header, Nav } from "../design/components"
import { useOpenTicketsCount } from "../hooks/useOpenTicketsCount"
import { useIsProPlan } from "../hooks/useIsProPlan"
import { getRoles, isStaff } from "../lib/staff"
import { useAuth } from "../state/AuthContext"
import { useContext_ } from "../state/ContextProvider"
import { ContextBadge } from "./ContextBadge"
import { ContextSwitcher } from "./ContextSwitcher"
import { ImpersonationBanner } from "./ImpersonationBanner"
import { NotificationsBell } from "./NotificationsBell"

/**
 * Routes that show the tenant-context pill. Auth / landing / staff pages are
 * deliberately excluded — context switching is a product-surface concept.
 */
const BADGE_ROUTES = [
  "/dashboard",
  "/scanner",
  "/devices",
  "/accounts",
  "/incidents",
  "/breach",
  "/vault",
  "/passwords",
  "/family",
  "/billing",
  "/awareness",
  "/settings",
  "/org",
]

export function Layout() {
  const { user, logout } = useAuth()
  const ctx = useContext_()
  const { contextId, contextName } = ctx
  const location = useLocation()
  const staff = isStaff(user)
  const roles = getRoles(user)
  const openTickets = useOpenTicketsCount(user)
  const isPro = useIsProPlan()
  const navUser = user ? { email: user.email, username: user.username } : undefined
  const inOrgContext = contextId !== null
  const orgRole = inOrgContext ? (ctx.organizations.find((o:any)=>o.id===contextId)?.role) : null
  const showBadge = BADGE_ROUTES.some(
    (route) => location.pathname === route || location.pathname.startsWith(`${route}/`),
  )

  return (
    <div className="amk-app">
      <ImpersonationBanner />
      <Header
        user={navUser}
        onSignOut={() => void logout()}
        context={user ? <ContextSwitcher /> : undefined}
        subtitle={inOrgContext ? contextName : undefined}
        notifications={user ? <NotificationsBell /> : undefined}
      />
      <div className="amk-body">
        <Nav
          staff={staff}
          roles={roles}
          openTickets={openTickets}
          user={navUser}
          onSignOut={() => void logout()}
          showUpgrade={!isPro}
          inOrgContext={inOrgContext}
          orgRole={orgRole}
        />
        <main className="amk-main">
          {showBadge && <ContextBadge />}
          <Outlet />
        </main>
      </div>
    </div>
  )
}