import { useId, type TextareaHTMLAttributes } from "react"
import { cx } from "../utils"

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  hint?: string
  error?: string
}

export function Textarea({ label, hint, error, id, className, ...rest }: TextareaProps) {
  const autoId = useId()
  const areaId = id ?? autoId
  const hintId = hint ? `${areaId}-hint` : undefined
  const errorId = error ? `${areaId}-error` : undefined

  return (
    <div className="amk-field">
      {label && (
        <label className="amk-label" htmlFor={areaId}>
          {label}
        </label>
      )}
      <textarea
        id={areaId}
        className={cx("amk-textarea", error && "is-invalid", className)}
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
