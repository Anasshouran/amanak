import { Outlet } from "react-router-dom"
import { Header, Nav } from "../design/components"
import { useOpenTicketsCount } from "../hooks/useOpenTicketsCount"
import { getRoles, isStaff } from "../lib/staff"
import { useAuth } from "../state/AuthContext"
import { ImpersonationBanner } from "./ImpersonationBanner"
import { NotificationsBell } from "./NotificationsBell"

export function Layout() {
  const { user, logout } = useAuth()
  const staff = isStaff(user)
  const roles = getRoles(user)
  const openTickets = useOpenTicketsCount(user)

  return (
    <div className="amk-app">
      <ImpersonationBanner />
      <Header
        email={user?.email}
        onSignOut={() => void logout()}
        notifications={user ? <NotificationsBell /> : undefined}
      />
      <div className="amk-body">
        <Nav staff={staff} roles={roles} openTickets={openTickets} />
        <main className="amk-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}