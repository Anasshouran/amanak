import { Navigate } from "react-router-dom"
import type { ReactNode } from "react"
import { useAuth } from "../state/AuthContext"

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="amk-auth">
        <span className="amk-spinner" style={{ width: 28, height: 28, color: "var(--c-brand)" }} />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
