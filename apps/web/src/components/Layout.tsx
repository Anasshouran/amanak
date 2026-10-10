import { Link, Outlet } from "react-router-dom"
import { useAuth } from "../state/AuthContext"

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.75rem 1.5rem",
          background: "#1e293b",
        }}
      >
        <strong>
          <Link to="/" style={{ color: "#38bdf8", textDecoration: "none" }}>
            AMANAK أمانك
          </Link>
        </strong>
        {user && (
          <nav style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <Link to="/" style={{ color: "#e2e8f0" }}>Dashboard</Link>
            <Link to="/accounts" style={{ color: "#e2e8f0" }}>Accounts</Link>
            <Link to="/devices" style={{ color: "#e2e8f0" }}>Devices</Link>
            <Link to="/incidents" style={{ color: "#e2e8f0" }}>Incidents</Link>
            <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>{user.email}</span>
            <button onClick={() => void logout()} style={{ cursor: "pointer" }}>
              Log out
            </button>
          </nav>
        )}
      </header>
      <main style={{ padding: "1.5rem", maxWidth: "960px", margin: "0 auto" }}>
        <Outlet />
      </main>
    </div>
  )
}