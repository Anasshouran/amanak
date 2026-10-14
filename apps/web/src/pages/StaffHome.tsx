import { Card, ErrorState, KpiCard, Skeleton } from "../design/components"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { api } from "../lib/api"
import { formatDateTime } from "../lib/format"
import { canSeeAudit } from "../lib/staff"
import { useAsync } from "../lib/useAsync"
import { useAuth } from "../state/AuthContext"
import { Link } from "react-router-dom"

export function StaffHome() {
  const t = useT()
  const { locale } = useTheme()
  const { user } = useAuth()

  const overview = useAsync(async () => {
    const [users, blocked, openTickets] = await Promise.all([
      api.listStaffUsers({ page: 1 }),
      api.listStaffUsers({ status: "blocked", page: 1 }),
      api.listTickets({ status: "open", page: 1 }),
    ])
    return {
      totalUsers: users.count,
      blockedUsers: blocked.count,
      openTickets: openTickets.count,
    }
  })

  const audit = useAsync(async () => {
    if (!canSeeAudit(user)) return null
    return api.listAuditLog({ page: 1 })
  })

  if (overview.error) {
    return (
      <div className="amk-page">
        <ErrorState title={t("common.error")} onRetry={overview.reload} />
      </div>
    )
  }

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <h1>{t("staff.home.title")}</h1>
        <p>{t("staff.home.welcome", { email: user?.email ?? "" })}</p>
      </div>

      {overview.loading && !overview.data ? (
        <Skeleton height={120} />
      ) : (
        <Card padded elevated>
          <div className="amk-grid amk-grid--kpi">
            <KpiCard label={t("staff.home.kpi.totalUsers")} value={overview.data?.totalUsers ?? 0} />
            <KpiCard
              label={t("staff.home.kpi.subscriptions")}
              value={overview.data?.totalUsers ?? 0}
            />
            <KpiCard label={t("staff.home.kpi.openTickets")} value={overview.data?.openTickets ?? 0} />
            <KpiCard label={t("staff.home.kpi.blocked")} value={overview.data?.blockedUsers ?? 0} />
          </div>
        </Card>
      )}

      <p className="amk-muted" style={{ fontSize: 12 }}>
        {t("staff.home.metricsNote")}
      </p>

      {canSeeAudit(user) && (
        <Card padded elevated title={t("staff.home.recentActivity")}>
          {audit.loading && !audit.data ? (
            <Skeleton height={80} />
          ) : !audit.data || audit.data.results.length === 0 ? (
            <p className="amk-muted">{t("staff.home.noActivity")}</p>
          ) : (
            <ul className="amk-list">
              {audit.data.results.slice(0, 10).map((entry) => (
                <li key={entry.id} className="amk-listitem">
                  <span>{entry.action}</span>
                  <span className="amk-muted" style={{ fontSize: 12 }}>
                    {entry.actor_email ?? "—"} · {formatDateTime(entry.created_at, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card padded elevated title={t("staff.home.quickLinks")}>
        <div className="amk-row">
          <Link className="amk-btn amk-btn--secondary amk-btn--md" to="/staff/users">
            {t("staff.home.quickUsers")}
          </Link>
          <Link className="amk-btn amk-btn--secondary amk-btn--md" to="/staff/tickets">
            {t("staff.home.quickTickets")}
          </Link>
          {canSeeAudit(user) && (
            <Link className="amk-btn amk-btn--secondary amk-btn--md" to="/staff/audit">
              {t("staff.home.quickAudit")}
            </Link>
          )}
          <Link className="amk-btn amk-btn--secondary amk-btn--md" to="/staff/metrics">
            {t("staff.home.quickMetrics")}
          </Link>
        </div>
      </Card>
    </div>
  )
}
