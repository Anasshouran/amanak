import type { ReactNode } from "react"
import { cx } from "../utils"

export type ToastVariant = "success" | "error" | "info" | "warning"

export type ToastItem = {
  id: number
  message: ReactNode
  variant: ToastVariant
  durationMs: number
}

export function Toast({
  message,
  variant,
  durationMs,
  onDismiss,
}: {
  message: ReactNode
  variant: ToastVariant
  durationMs: number
  onDismiss: () => void
}) {
  return (
    <div className={cx("amk-toast", `amk-toast--${variant}`)} role="status">
      <div className="amk-toast__body">{message}</div>
      <button
        type="button"
        className="amk-iconbtn"
        aria-label="Dismiss notification"
        onClick={onDismiss}
        style={{ width: 24, height: 24 }}
      >
        ×
      </button>
      <span
        className="amk-toast__progress"
        aria-hidden="true"
        style={{ animationDuration: `${durationMs}ms` }}
      />
    </div>
  )
}
