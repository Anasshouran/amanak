import type { ReactNode } from "react"
import { IconInbox } from "../icons"

export type EmptyStateProps = {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="amk-state">
      <div className="amk-state__icon">{icon ?? <IconInbox size={30} />}</div>
      <div className="amk-state__title">{title}</div>
      {description && <div className="amk-state__desc">{description}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}
