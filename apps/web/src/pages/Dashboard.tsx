import { useState } from "react"
import type {
  BreachHit,
  DashboardOverview,
  ScanResultRecord,
  ScoreHistoryRange,
  ScoreHistoryResponse,
} from "@amanak/shared-types"
import { useNavigate } from "react-router-dom"
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LineChart,
  ProgressRing,
  Skeleton,
  Tabs,
} from "../design/components"
import { IconPlus, IconScanner, IconShield } from "../design/icons"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { useCountUp } from "../design/useCountUp"
import { api } from "../lib/api"
import { formatDateTime } from "../lib/format"
import { verdictVariant } from "../lib/labels"
import { errorMessage, useAsync } from "../lib/useAsync"

type DashboardData = {
  overview: DashboardOverview
  scans: ScanResultRecord[]
  hits: BreachHit[]
}

function Kpi({ label, value }: { label: string; value: number }) {
  const animated = useCountUp(value)
  return (
    <div className="amk-kpi">
      <span className="amk-kpi__value">{animated}</span>
      <span className="amk-kpi__label">{label}</span>
    </div>
  )
}

function verdictColor(variant: string): string {
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

function TrendCard() {
  const t = useT()
  const [range, setRange] = useState<ScoreHistoryRange>("30d")
  const { data, loading, error, reload } = useAsync<ScoreHistoryResponse>(
    () => api.getSecurityScoreHistory(range),
    [range],
  )

  const points = data?.points ?? []
  const hasTrend = points.length >= 2

  let deltaNode = null
  if (hasTrend && data) {
    const delta = data.delta
    const color =
      delta === 0 ? "var(--c-muted)" : delta > 0 ? "var(--c-success)" : "var(--c-danger)"
    const label =
      delta === 0
        ? String(delta)
        : t(delta > 0 ? "dashboard.trend.delta_up" : "dashboard.trend.delta_down", {
            delta: Math.abs(delta),
          })
    deltaNode = (
      <span
        title={label}
        aria-label={label}
        style={{ color, fontWeight: 600, whiteSpace: "nowrap" }}
      >
        <span aria-hidden="true">{delta > 0 ? "▲" : delta < 0 ? "▼" : "■"} </span>
        {delta > 0 ? "+" : ""}
        {delta}
      </span>
    )
  }

  return (
    <Card
      padded
      elevated
      title={t("dashboard.trend.title")}
      action={
        <Tabs
          items={[
            { id: "7d", label: t("dashboard.trend.range.7d") },
            { id: "30d", label: t("dashboard.trend.range.30d") },
            { id: "90d", label: t("dashboard.trend.range.90d") },
          ]}
          value={range}
          onChange={(id) => setRange(id as ScoreHistoryRange)}
          ariaLabel={t("dashboard.trend.title")}
        />
      }
    >
      {loading ? (
        <Skeleton height={180} />
      ) : error ? (
        <ErrorState
          title={t("dashboard.trend.error")}
          onRetry={reload}
          retryLabel={t("actions.retry")}
        />
      ) : !hasTrend ? (
        <p className="amk-muted">{t("dashboard.trend.empty")}</p>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700 }}>{data?.current}</span>
            <span className="amk-muted">
              {t("common.of")} 100
            </span>
            {deltaNode}
          </div>
          <LineChart
            data={points.map((point) => ({ label: point.date.slice(5), value: point.score }))}
            ariaLabel={t("dashboard.trend.aria", {
              from: points[0].score,
              to: points[points.length - 1].score,
            })}
          />
        </>
      )}
    </Card>
  )
}

export function Dashboard() {
  const t = useT()
  const { locale } = useTheme()
  const navigate = useNavigate()

  const { data, loading, error, reload } = useAsync<DashboardData>(() =>
    Promise.all([api.dashboard(), api.scanHistory(), api.listHits().catch(() => [])]).then(
      ([overview, scans, hits]) => ({ overview, scans, hits }),
    ),
  )

  if (loading) {
    return (
      <div className="amk-page">
        <div className="amk-page-head">
          <div>
            <h1>{t("dashboard.title")}</h1>
            <p>{t("dashboard.subtitle")}</p>
          </div>
        </div>
        <div className="amk-grid amk-grid--two">
          <Card padded elevated>
            <div style={{ display: "grid", justifyItems: "center", gap: 12 }}>
              <Skeleton width={160} height={160} radius="50%" />
              <Skeleton width={220} height={14} />
            </div>
          </Card>
          <Card padded elevated>
            <div className="amk-grid amk-grid--kpi">
              {[0, 1, 2, 3].map((i) => (
                <div className="amk-kpi" key={i}>
                  <Skeleton width={48} height={28} />
                  <Skeleton width={80} height={13} />
                </div>
              ))}
            </div>
          </Card>
        </div>
        <Card padded elevated title={t("dashboard.recentActivity")}>
          <div className="amk-stack">
            <Skeleton height={44} />
            <Skeleton height={44} />
            <Skeleton height={44} />
          </div>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="amk-page">
        <ErrorState
          title={t("common.error")}
          message={errorMessage(error, t("common.error"))}
          onRetry={reload}
          retryLabel={t("actions.retry")}
        />
      </div>
    )
  }

  const { overview, scans, hits } = data
  const isEmpty =
    overview.accounts === 0 &&
    overview.devices === 0 &&
    overview.open_incidents === 0 &&
    scans.length === 0

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{t("dashboard.title")}</h1>
          <p>{t("dashboard.subtitle")}</p>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState
          icon={<IconShield size={30} />}
          title={t("dashboard.empty.title")}
          description={t("dashboard.empty.description")}
          action={
            <Button icon={<IconScanner size={16} />} onClick={() => navigate("/scanner")}>
              {t("dashboard.action.scanUrl")}
            </Button>
          }
        />
      ) : (
        <div className="amk-grid amk-grid--two">
          <Card padded elevated title={t("dashboard.securityScore")}>
              <div style={{ display: "grid", justifyItems: "center", gap: 12 }}>
                <ProgressRing value={overview.security_score} caption={`${t("common.of")} 100`} />
                <p className="amk-muted" style={{ textAlign: "center" }}>
                  {t("dashboard.scoreDescription")}
                </p>
              </div>
            </Card>

            <Card padded elevated>
              <div className="amk-grid amk-grid--kpi">
                <Kpi label={t("dashboard.accounts")} value={overview.accounts} />
                <Kpi label={t("dashboard.devices")} value={overview.devices} />
                <Kpi label={t("dashboard.openIncidents")} value={overview.open_incidents} />
                <Kpi label={t("dashboard.breachHits")} value={hits.length} />
              </div>
            </Card>
          </div>
      )}

      <TrendCard />

      {!isEmpty && (
        <div className="amk-grid amk-grid--two">
          <Card padded elevated title={t("dashboard.quickActions")}>
              <div className="amk-row">
                <Button icon={<IconScanner size={16} />} onClick={() => navigate("/scanner")}>
                  {t("dashboard.action.scanUrl")}
                </Button>
                <Button variant="secondary" onClick={() => navigate("/scanner?tab=message")}>
                  {t("dashboard.action.scanMessage")}
                </Button>
                <Button
                  variant="secondary"
                  icon={<IconPlus size={16} />}
                  onClick={() => navigate("/accounts")}
                >
                  {t("dashboard.action.addAccount")}
                </Button>
              </div>
            </Card>

            <Card padded elevated title={t("dashboard.recentActivity")}>
              {scans.length === 0 ? (
                <p className="amk-muted">{t("dashboard.noActivity")}</p>
              ) : (
                <ul className="amk-activity">
                  {scans.slice(0, 5).map((scan) => (
                    <li className="amk-activity__item" key={scan.id}>
                      <span
                        className="amk-activity__dot"
                        style={{ color: verdictColor(verdictVariant(scan.verdict)) }}
                        aria-hidden="true"
                      />
                      <div style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
                        <span
                          className="amk-mono"
                          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {scan.preview}
                        </span>
                        <span className="amk-activity__meta">
                          {formatDateTime(scan.created_at, locale)}
                        </span>
                      </div>
                      <Badge variant={verdictVariant(scan.verdict)}>
                        {t(`scanner.verdict.${scan.verdict}`)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
      )}
    </div>
  )
}
