import { useCallback, useEffect, useState } from "react"
import { RefreshControl, ScrollView, View } from "react-native"
import type {
  DashboardOverview,
  MonitoredEmail,
  ScanResultRecord,
  ScoreHistoryResponse,
} from "@amanak/shared-types"
import { ActionCards } from "../../components/ActionCards"
import { ActivityFeed } from "../../components/ActivityFeed"
import { Greeting } from "../../components/Greeting"
import { Header } from "../../components/Header"
import { KpiRow, type KpiItem } from "../../components/KpiRow"
import { ScoreCard } from "../../components/ScoreCard"
import { useT } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"
import { theme } from "../../theme"
import { api } from "../../lib/api"

/**
 * P17.2 dashboard: greeting, score card, KPI strip, action cards, activity feed.
 *
 * Each request settles independently so a single failing endpoint (e.g. breach
 * monitoring without entitlement) never blanks the rest of the screen.
 */
export default function Dashboard() {
  const t = useT()
  const tokens = useTokens()

  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [history, setHistory] = useState<ScoreHistoryResponse | null>(null)
  const [scans, setScans] = useState<ScanResultRecord[]>([])
  const [monitored, setMonitored] = useState<MonitoredEmail[]>([])

  const [loading, setLoading] = useState(true)
  const [scoreError, setScoreError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const [ov, hist, scanList, emailList] = await Promise.allSettled([
      api.dashboard(),
      api.getSecurityScoreHistory("7d"),
      api.scanHistory(),
      api.listMonitoredEmails(),
    ])

    if (ov.status === "fulfilled") setOverview(ov.value)
    else setScoreError(true)

    if (hist.status === "fulfilled") setHistory(hist.value)
    else setScoreError(true)

    if (scanList.status === "fulfilled") setScans(scanList.value)
    if (emailList.status === "fulfilled") setMonitored(emailList.value)
  }, [])

  useEffect(() => {
    let active = true
    void load()
      .catch(() => {
        if (active) setScoreError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [load])

  async function onRefresh() {
    setRefreshing(true)
    await load().catch(() => undefined)
    setRefreshing(false)
  }

  const breachEnabled = monitored.length > 0
  const dash = (value: number | undefined): string => (value === undefined ? "—" : String(value))

  const kpiItems: KpiItem[] = [
    { key: "devices", label: t("dashboard.devices"), value: dash(overview?.devices) },
    { key: "accounts", label: t("dashboard.accounts"), value: dash(overview?.accounts) },
    {
      key: "incidents",
      label: t("dashboard.openIncidents"),
      value: dash(overview?.open_incidents),
      ...(overview && overview.open_incidents > 0 ? { tint: "danger" as const } : {}),
    },
    {
      key: "breach",
      label: t("dashboard.breachStatus"),
      value: t(breachEnabled ? "dashboard.breachOn" : "dashboard.breachOff"),
      tint: breachEnabled ? "success" : "muted",
    },
  ]

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <Header title={t("dashboard.title")} />
      <ScrollView
        contentContainerStyle={{
          padding: tokens.space[4],
          paddingBottom: tokens.space[12],
          gap: tokens.space[6],
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={tokens.c.brand}
            colors={[tokens.c.brand]}
          />
        }
      >
        <Greeting />
        <ScoreCard
          score={overview?.security_score ?? 0}
          history={history}
          loading={loading}
          error={scoreError}
          onRetry={() => void load()}
        />
        <KpiRow items={kpiItems} />
        <ActionCards breachEnabled={breachEnabled} />
        <ActivityFeed items={scans} loading={loading} />
      </ScrollView>
    </View>
  )
}
