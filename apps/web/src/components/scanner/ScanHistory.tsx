import type { ScanResultRecord } from "@amanak/shared-types"
import { useT } from "../../design/i18n"
import { useTheme } from "../../design/ThemeProvider"
import { formatRelativeTime } from "../../lib/format"

export type ScanHistoryProps = {
  items: ScanResultRecord[]
  onSelect?: (item: ScanResultRecord) => void
}

export function ScanHistory({ items, onSelect }: ScanHistoryProps) {
  const t = useT()
  const { locale } = useTheme()

  if (items.length === 0) {
    return <p className="amk-muted">{t("scanner.history.empty")}</p>
  }

  return (
    <ul className="scan-history" role="list">
      {items.map((item) => (
        <li className="scan-history__item" key={item.id}>
          <button
            type="button"
            className="scan-history__button"
            data-verdict={item.verdict}
            onClick={() => onSelect?.(item)}
            aria-label={`${t("scanner.history.viewResult")}: ${item.preview}`}
          >
            <span className="scan-history__dot" aria-hidden="true" />
            <div className="scan-history__body">
              <span dir="ltr" className="amk-mono scan-history__preview" title={item.preview}>
                {item.preview}
              </span>
              <span className="scan-history__meta">
                {t(`scanner.verdict.${item.verdict}`)} · {formatRelativeTime(item.created_at, locale)}
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
