import { Outlet } from "react-router-dom"
import { Header, Nav } from "../design/components"
import { useOpenTicketsCount } from "../hooks/useOpenTicketsCount"
import { useIsProPlan } from "../hooks/useIsProPlan"
import { getRoles, isStaff } from "../lib/staff"
import { useAuth } from "../state/AuthContext"
import { ImpersonationBanner } from "./ImpersonationBanner"
import { NotificationsBell } from "./NotificationsBell"

export function Layout() {
  const { user, logout } = useAuth()
  const staff = isStaff(user)
  const roles = getRoles(user)
  const openTickets = useOpenTicketsCount(user)
  const isPro = useIsProPlan()
  const navUser = user ? { email: user.email, username: user.username } : undefined

  return (
    <div className="amk-app">
      <ImpersonationBanner />
      <Header
        user={navUser}
        onSignOut={() => void logout()}
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
        />
        <main className="amk-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}