import type { ReactNode } from "react"
import { IconAlert } from "../icons"
import { Button } from "./Button"

export type ErrorStateProps = {
  title: ReactNode
  message?: ReactNode
  onRetry?: () => void
  retryLabel?: string
}

export function ErrorState({ title, message, onRetry, retryLabel = "Retry" }: ErrorStateProps) {
  return (
    <div className="amk-state amk-state--error" role="alert">
      <div className="amk-state__icon" style={{ color: "var(--c-danger)" }}>
        <IconAlert size={30} />
      </div>
      <div className="amk-state__title">{title}</div>
      {message && <div className="amk-state__desc">{message}</div>}
      {onRetry && (
        <div style={{ marginTop: 8 }}>
          <Button variant="secondary" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
