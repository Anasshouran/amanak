import type { ReactNode } from "react"
import { cx } from "../utils"

export type BadgeVariant =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "low"
  | "medium"
  | "high"
  | "critical"

export function Badge({
  variant = "neutral",
  children,
  className,
}: {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}) {
  return <span className={cx("amk-badge", `amk-badge--${variant}`, className)}>{children}</span>
}
