import { useRef } from "react"
import { cx } from "../../design/utils"

export type SegmentedTab = { id: string; label: string }

export function SegmentedTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: SegmentedTab[]
  value: string
  onChange: (id: string) => void
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKey(e: React.KeyboardEvent, idx: number) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault()
      const dir = e.key === "ArrowRight" ? 1 : -1
      const next = (idx + dir + tabs.length) % tabs.length
      refs.current[next]?.focus()
      onChange(tabs[next].id)
    }
  }

  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        gap: "var(--space-1)",
        padding: "var(--space-1)",
        borderRadius: "var(--c-radius-lg)",
        background: "var(--c-bg)",
        border: "1px solid var(--c-border)",
      }}
    >
      {tabs.map((t, i) => {
        const selected = t.id === value
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[i] = el }}
            role="tab"
            aria-selected={selected}
            type="button"
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cx("amk-segmented-tab", selected && "is-active")}
            style={{
              padding: "var(--space-2) var(--space-4)",
              borderRadius: "var(--c-radius-md)",
              border: "none",
              cursor: "pointer",
              fontWeight: selected ? 700 : 500,
              background: selected ? "var(--c-surface)" : "transparent",
              color: selected ? "var(--c-text)" : "var(--c-muted)",
              boxShadow: selected ? "var(--c-shadow-sm)" : "none",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
