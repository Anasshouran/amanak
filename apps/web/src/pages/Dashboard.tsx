import type { DashboardOverview, ScoreHistoryResponse, ScanResultRecord } from "@amanak/shared-types"
import { useAsync } from "../lib/useAsync"
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

      <ActionCards breachEnabled={breachEnabled} />

      <div className="dash-bottom">
        <TrendCard />
        <ActivityFeed items={scans.data ?? []} loading={scans.loading} />
        <QuickActions />
      </div>
    </div>
  )
}
