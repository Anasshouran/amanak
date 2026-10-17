import type { ScoreHistoryResponse } from "@amanak/shared-types"
import { Card, ProgressRing, Skeleton } from "../../design/components"
import { ErrorState } from "../../design/components"
import { useT } from "../../design/i18n"
import { errorMessage } from "../../lib/useAsync"
import { MiniTrend } from "./MiniTrend"

export type ScoreCardProps = {
  score: number
  history: ScoreHistoryResponse | null
  loading?: boolean
  error?: unknown
  onRetry?: () => void
}

type Level = "good" | "fair" | "weak"

function levelOf(score: number): Level {
  if (score >= 70) return "good"
  if (score >= 40) return "fair"
  return "weak"
}

const LEVEL_COLOR: Record<Level, string> = {
  good: "var(--c-success)",
  fair: "var(--c-warning)",
  weak: "var(--c-danger)",
}

export function ScoreCard({ score, history, loading, error, onRetry }: ScoreCardProps) {
  const t = useT()

  if (loading) {
    return (
      <Card padded elevated className="dash-scorecard">
        <span className="dash-scorecard__title">{t("dashboard.score.title")}</span>
        <div className="dash-scorecard__body">
          <Skeleton width={132} height={132} radius="50%" />
          <div className="dash-scorecard__meta">
            <Skeleton width={64} height={16} />
            <Skeleton width={120} height={13} />
            <Skeleton width={96} height={36} />
          </div>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card padded elevated className="dash-scorecard">
        <span className="dash-scorecard__title">{t("dashboard.score.title")}</span>
        <ErrorState
          title={t("dashboard.score.error")}
          message={errorMessage(error, t("common.error"))}
          onRetry={onRetry}
          retryLabel={t("actions.retry")}
        />
      </Card>
    )
  }

  const level = levelOf(score)
  const statusLabel = t(`dashboard.score.status.${level}`)
  const ariaLabel = t("dashboard.score.aria", { score, status: statusLabel })

  const points = history?.points ?? []
  const scores = points.map((point) => point.score)
  const hasTrend = scores.length >= 2
  const delta = history?.delta ?? 0
  const trend = history?.trend ?? "flat"

  let deltaColor = "var(--c-muted)"
  if (delta > 0) deltaColor = "var(--c-success)"
  else if (delta < 0) deltaColor = "var(--c-danger)"

  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "■"
  const prev = points.length > 0 ? points[0].score : score - delta
  const prevText =
    trend === "up"
      ? t("dashboard.score.improved", { prev })
      : trend === "down"
        ? t("dashboard.score.declined", { prev })
        : t("dashboard.score.steady")

  return (
    <Card padded elevated className="dash-scorecard">
      <span className="dash-scorecard__title">{t("dashboard.score.title")}</span>
      <div className="dash-scorecard__body" role="img" aria-label={ariaLabel}>
        <ProgressRing
          value={score}
          size={132}
          stroke={12}
          label={score}
          caption={t("dashboard.score.denominator")}
        />
        <div className="dash-scorecard__meta">
          <span
            className="dash-scorecard__status"
            data-level={level}
            style={{ color: LEVEL_COLOR[level] }}
          >
            {statusLabel}
          </span>
          {hasTrend && (
            <span className="dash-scorecard__delta" style={{ color: deltaColor }}>
              <span aria-hidden="true">{arrow} </span>
              {delta > 0 ? "+" : ""}
              {delta}
              <span className="dash-scorecard__prev amk-muted"> {prevText}</span>
            </span>
          )}
          {hasTrend && (
            <MiniTrend points={scores} className="dash-scorecard__spark" />
          )}
        </div>
      </div>
    </Card>
  )
}
