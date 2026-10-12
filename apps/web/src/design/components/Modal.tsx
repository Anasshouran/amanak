import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react"
import { IconClose } from "../icons"
import { trapFocus } from "../utils"

export type ModalProps = {
  open: boolean
  onClose: () => void
  title: ReactNode
  children?: ReactNode
  actions?: ReactNode
}

export function Modal({ open, onClose, title, children, actions }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    dialogRef.current?.focus()
    return () => {
      document.removeEventListener("keydown", onKey)
      previouslyFocused.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") {
      trapFocus(event.nativeEvent, dialogRef.current)
    }
  }

  return (
    <div
      className="amk-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="amk-modal"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="amk-card__head">
          <h2 className="amk-modal__title">{title}</h2>
          <button type="button" className="amk-iconbtn" aria-label="Close dialog" onClick={onClose}>
            <IconClose />
          </button>
        </div>
        {children}
        {actions && <div className="amk-modal__actions">{actions}</div>}
      </div>
    </div>
  )
}
