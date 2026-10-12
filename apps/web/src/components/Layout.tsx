import { Outlet } from "react-router-dom"
import { Header, Nav } from "../design/components"
import { useAuth } from "../state/AuthContext"

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="amk-app">
      <Header email={user?.email} onSignOut={() => void logout()} />
      <div className="amk-body">
        <Nav />
        <main className="amk-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
