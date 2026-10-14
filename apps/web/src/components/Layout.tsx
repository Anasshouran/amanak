import { Outlet } from "react-router-dom"
import { Header, Nav } from "../design/components"
import { useAuth } from "../state/AuthContext"
import { isStaff } from "../lib/staff"
import { ImpersonationBanner } from "./ImpersonationBanner"
import { NotificationsBell } from "./NotificationsBell"

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="amk-app">
      <ImpersonationBanner />
      <Header
        email={user?.email}
        onSignOut={() => void logout()}
        notifications={user ? <NotificationsBell /> : undefined}
      />
      <div className="amk-body">
        <Nav staff={isStaff(user)} />
        <main className="amk-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
