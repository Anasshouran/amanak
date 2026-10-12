import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cx } from "../utils"

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger"
export type ButtonSize = "sm" | "md" | "lg"

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  fullWidth?: boolean
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconRight,
  fullWidth = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "amk-btn",
        `amk-btn--${variant}`,
        `amk-btn--${size}`,
        fullWidth && "amk-btn--full",
        loading && "is-loading",
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="amk-spinner" aria-hidden="true" /> : icon}
      {children != null && children !== "" && <span>{children}</span>}
      {iconRight}
    </button>
  )
}
