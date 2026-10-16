import type { ScanResultRecord } from "@amanak/shared-types"
import { Link } from "react-router-dom"
import { Card, EmptyState, Skeleton } from "../../design/components"
import type { BadgeVariant } from "../../design/components"
import { useT } from "../../design/i18n"
import { IconScanner } from "../../design/icons"
import { useTheme } from "../../design/ThemeProvider"
import { verdictVariant } from "../../lib/labels"

export type ActivityFeedProps = {
  items: ScanResultRecord[]
  loading?: boolean
}

function verdictColor(variant: BadgeVariant): string {
  switch (variant) {
    case "success":
      return "var(--c-success)"
    case "warning":
      return "var(--c-warning)"
    case "danger":
      return "var(--c-danger)"
    default:
      return "var(--c-muted)"
  }
}

function relativeTime(iso: string, locale: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const bcp47 = locale === "ar" ? "ar" : "en"
  const diff = then - Date.now()
  const abs = Math.abs(diff)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  try {
    const rtf = new Intl.RelativeTimeFormat(bcp47, { numeric: "auto" })
    if (abs < hour) return rtf.format(Math.round(diff / minute), "minute")
    if (abs < day) return rtf.format(Math.round(diff / hour), "hour")
    return rtf.format(Math.round(diff / day), "day")
  } catch {
    return new Date(then).toLocaleDateString(bcp47)
  }
}

export function ActivityFeed({ items, loading }: ActivityFeedProps) {
  const t = useT()
  const { locale } = useTheme()
  const visible = items.slice(0, 5)

  return (
    <Card
      padded
      elevated
      className="dash-activity-card"
      title={t("dashboard.recentActivity")}
      action={
        <Link to="/scanner" className="dash-card-link">
          {t("dashboard.activity.viewAll")}
        </Link>
      }
    >
      {loading ? (
        <div className="amk-stack">
          <Skeleton height={44} />
          <Skeleton height={44} />
          <Skeleton height={44} />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<IconScanner size={28} />}
          title={t("dashboard.activity.empty")}
        />
      ) : (
        <ul className="dash-activity" role="list">
          {visible.map((scan) => {
            const color = verdictColor(verdictVariant(scan.verdict))
            return (
              <li className="dash-activity__item" key={scan.id}>
                <span
                  className="dash-activity__dot"
                  style={{ background: color }}
                  aria-hidden="true"
                />
                <div className="dash-activity__body">
                  <span className="dash-activity__title">{scan.preview}</span>
                  <span className="dash-activity__meta">
                    {t(`scanner.verdict.${scan.verdict}`)}
                  </span>
                </div>
                <time className="dash-activity__time" dateTime={scan.created_at}>
                  {relativeTime(scan.created_at, locale)}
                </time>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
