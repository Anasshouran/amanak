import { useEffect, useMemo, useRef, useState } from "react"
import { useT } from "../design/i18n"
import { IconCheck } from "../design/icons"
import { useContext_ } from "../state/ContextProvider"

type Option = {
  id: string | null
  name: string
  icon: string
}

/**
 * Header dropdown for switching between the personal context and the user's
 * organizations (P18.1c2).
 *
 * With no organizations the trigger is a static label; otherwise it opens a
 * keyboard-navigable menu (ESC closes, arrows move, Enter selects).
 */
export function ContextSwitcher() {
  const t = useT()
  const { contextId, organizations, switchContext } = useContext_()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const options: Option[] = useMemo(
    () => [
      { id: null, name: t("context.switcher.personal"), icon: "🏠" },
      ...organizations.map((org) => ({ id: org.id, name: org.name, icon: "🏢" })),
    ],
    [organizations, t],
  )

  const current = options.find((o) => o.id === contextId) ?? options[0]
  const hasOrgs = organizations.length > 0

  useEffect(() => {
    if (!open) return
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.id === contextId)
      setActive(idx >= 0 ? idx : 0)
    }
  }, [open, contextId, options])

  if (!hasOrgs) {
    return (
      <span className="amk-contextswitcher amk-contextswitcher--static" title={current.name}>
        <span aria-hidden="true">{current.icon}</span>
        <span className="amk-contextswitcher__label">{current.name}</span>
      </span>
    )
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setOpen(false)
    } else if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((i) => (i + 1) % options.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((i) => (i - 1 + options.length) % options.length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      setOpen(false)
      if (options[active]?.id !== contextId) switchContext(options[active]?.id ?? null)
    }
  }

  return (
    <div className="amk-contextswitcher" ref={rootRef}>
      <button
        type="button"
        className="amk-contextswitcher__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("context.switcher.title")}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span aria-hidden="true">{current.icon}</span>
        <span className="amk-contextswitcher__label">{current.name}</span>
        <span className="amk-contextswitcher__caret" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <div className="amk-contextswitcher__panel" role="listbox">
          {options.map((option, index) => {
            const selected = option.id === contextId
            return (
              <button
                key={option.id ?? "personal"}
                type="button"
                role="option"
                aria-selected={selected}
                className={`amk-contextoption${index === active ? " is-active" : ""}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => {
                  setOpen(false)
                  if (option.id !== contextId) switchContext(option.id)
                }}
              >
                <span aria-hidden="true">{option.icon}</span>
                <span className="amk-contextoption__name">{option.name}</span>
                {selected && <IconCheck size={16} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
