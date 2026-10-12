import { useId, type InputHTMLAttributes } from "react"
import { cx } from "../utils"

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string
}

export function Input({ label, hint, error, id, className, ...rest }: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined

  return (
    <div className="amk-field">
      {label && (
        <label className="amk-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cx("amk-input", error && "is-invalid", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        {...rest}
      />
      {hint && !error && (
        <span id={hintId} className="amk-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="amk-field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
