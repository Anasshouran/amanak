import { useState } from "react"
import type { ScoreHistoryRange, ScoreHistoryResponse } from "@amanak/shared-types"
import { Card, ErrorState, LineChart, Skeleton, Tabs } from "../../design/components"
import { useT } from "../../design/i18n"
import { api } from "../../lib/api"
import { errorMessage, useAsync } from "../../lib/useAsync"

const RANGES: ScoreHistoryRange[] = ["7d", "30d", "90d"]

export function TrendCard() {
  const t = useT()
  const [range, setRange] = useState<ScoreHistoryRange>("30d")
  const { data, loading, error, reload } = useAsync<ScoreHistoryResponse>(
    () => api.getSecurityScoreHistory(range),
    [range],
  )

  const points = data?.points ?? []
  const hasTrend = points.length >= 2

  return (
    <Card
      padded
      elevated
      className="dash-trend"
      title={t("dashboard.trend.title")}
      action={
        <Tabs
          items={RANGES.map((id) => ({ id, label: t(`dashboard.trend.range.${id}`) }))}
          value={range}
          onChange={(id) => setRange(id as ScoreHistoryRange)}
          ariaLabel={t("dashboard.trend.title")}
        />
      }
    >
      {loading ? (
        <Skeleton height={200} />
      ) : error ? (
        <ErrorState
          title={t("dashboard.trend.error")}
          message={errorMessage(error, t("common.error"))}
          onRetry={reload}
          retryLabel={t("actions.retry")}
        />
      ) : !hasTrend ? (
        <p className="amk-muted dash-trend__empty">{t("dashboard.trend.empty")}</p>
      ) : (
        <LineChart
          data={points.map((point) => ({ label: point.date.slice(5), value: point.score }))}
          height={200}
          minY={40}
          maxY={100}
          ariaLabel={t("dashboard.trend.aria", {
            from: points[0].score,
            to: points[points.length - 1].score,
          })}
        />
      )}
    </Card>
  )
}
