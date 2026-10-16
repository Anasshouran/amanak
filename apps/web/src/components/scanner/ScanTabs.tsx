import type { KeyboardEvent } from "react"
import type { ScanKind } from "@amanak/shared-types"
import { useT } from "../../design/i18n"
import { cx } from "../../design/utils"

export type ScanTabsProps = {
  value: ScanKind
  onChange: (kind: ScanKind) => void
  className?: string
}

const ORDER: ScanKind[] = ["url", "message"]

export function ScanTabs({ value, onChange, className }: ScanTabsProps) {
  const t = useT()

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
    const idx = ORDER.indexOf(value)
    if (idx === -1) return
    // Under RTL the visual order mirrors, so swap the arrow meaning.
    const rtl = document.documentElement.dir === "rtl"
    const forward = rtl ? e.key === "ArrowLeft" : e.key === "ArrowRight"
    const nextIdx = forward ? (idx + 1) % ORDER.length : (idx - 1 + ORDER.length) % ORDER.length
    onChange(ORDER[nextIdx])
    e.preventDefault()
    document.getElementById(`tab-${ORDER[nextIdx]}`)?.focus()
  }

  return (
    <div
      className={cx("scan-tabs", className)}
      role="tablist"
      aria-label={t("scanner.title")}
      onKeyDown={handleKeyDown}
    >
      {ORDER.map((kind) => {
        const selected = kind === value
        return (
          <button
            key={kind}
            type="button"
            role="tab"
            id={`tab-${kind}`}
            aria-selected={selected}
            aria-controls={`panel-${kind}`}
            tabIndex={selected ? 0 : -1}
            className={cx("scan-tab", selected && "is-active")}
            onClick={() => onChange(kind)}
          >
            {kind === "url" ? t("scanner.tab.urlLong") : t("scanner.tab.messageLong")}
          </button>
        )
      })}
    </div>
  )
}
