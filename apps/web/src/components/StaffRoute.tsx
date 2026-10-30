import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "../state/AuthContext"
import { useToast } from "../design/components"
import { useT } from "../design/i18n"
import { hasRole, isStaff } from "../lib/staff"

export interface StaffRouteProps {
  children: ReactNode
  requiredRole?: "super_admin" | "security_admin" | "billing_admin" | "support"
}

export function StaffRoute({ children, requiredRole }: StaffRouteProps) {
  const { user, loading } = useAuth()
  const toast = useToast()
  const t = useT()

  if (loading) {
    return (
      <div className="amk-auth">
        <span className="amk-spinner" style={{ width: 28, height: 28, color: "var(--c-brand)" }} />
      </div>
    )
  }

  if (requiredRole && !hasRole(user, requiredRole)) {
    toast.push(t("staff.forbidden"), "error")
    return <Navigate to="/dashboard" replace />
  }

  if (!isStaff(user)) {
    toast.push(t("staff.forbidden"), "error")
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
