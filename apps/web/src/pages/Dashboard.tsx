import type { DashboardOverview, ScoreHistoryResponse, ScanResultRecord } from "@amanak/shared-types"
import { useAsync } from "../lib/useAsync"
import { useT } from "../design/i18n"
import { api } from "../lib/api"
import { ActivityFeed } from "../components/dashboard/ActivityFeed"
import { ActionCards } from "../components/dashboard/ActionCards"
import { Greeting } from "../components/dashboard/Greeting"
import { QuickActions } from "../components/dashboard/QuickActions"
import { ScoreCard } from "../components/dashboard/ScoreCard"
import { TrendCard } from "../components/dashboard/TrendCard"

export function Dashboard() {
  const overview = useAsync<DashboardOverview>(() => api.dashboard())
  const scoreHistory = useAsync<ScoreHistoryResponse>(() => api.getSecurityScoreHistory("7d"))
  const scans = useAsync<ScanResultRecord[]>(() => api.scanHistory())
  const emails = useAsync(() => api.listMonitoredEmails())
  const alerts = useAsync(() => api.getAlerts())

  const t = useT()
  const score = overview.data?.security_score ?? 0
  const breachEnabled = (emails.data?.length ?? 0) > 0

  return (
    <div className="amk-page dash-page">
      <div className="dash-top">
        <Greeting />
        <ScoreCard
          score={score}
          history={scoreHistory.data}
          loading={overview.loading}
          error={overview.error}
          onRetry={() => {
            overview.reload()
            scoreHistory.reload()
          }}
        />
      </div>

      {alerts.data && alerts.data.length > 0 && (
        <div
          className="amk-card amk-card--padded"
          style={{
            border: "1px solid var(--c-danger)",
            background: "var(--c-surface)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <div>
            <strong style={{ color: "var(--c-danger)" }}>
              {t("security.dashboard.alert_title")} ({alerts.data.length})
            </strong>
            <div style={{ color: "var(--c-muted)", fontSize: "var(--fs-sm)" }}>
              {t("security.dashboard.alert_cta")}
            </div>
          </div>
          <a href="/security" className="amk-btn amk-btn--danger amk-btn--sm">
            {t("security.dashboard.alert_cta")}
          </a>
        </div>
      )}

      <ActionCards breachEnabled={breachEnabled} />

      <div className="dash-bottom">
        <TrendCard />
        <ActivityFeed items={scans.data ?? []} loading={scans.loading} />
        <QuickActions />
      </div>
    </div>
  )
}
