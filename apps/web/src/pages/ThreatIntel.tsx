import { useEffect, useState } from "react"
import { Button, Card, ErrorState, Input, Skeleton } from "../design/components"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { api } from "../lib/api"
import { errorMessage, useAsync } from "../lib/useAsync"

type Feed = {
  source: string
  count: number
  last_sync: number | null
  status: string
}

export function ThreatIntel() {
  const t = useT()
  const { locale } = useTheme()
  const [checkDomain, setCheckDomain] = useState("")
  const [checkResult, setCheckResult] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const status = useAsync(async () => {
    const res = await api.getThreatIntelStatus()
    return res.feeds as Feed[]
  })

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await api.refreshThreatIntel()
      await status.reload()
    } catch (e) {
      // ignore
    } finally {
      setRefreshing(false)
    }
  }

  const handleCheck = async () => {
    if (!checkDomain.trim()) return
    try {
      const res = await api.checkThreatIntelDomain(checkDomain.trim())
      setCheckResult(res.matched ? `${res.source} (${res.confidence})` : "not matched")
    } catch (e) {
      setCheckResult(errorMessage(e, "Check failed"))
    }
  }

  if (status.loading) return <Skeleton />
  if (status.error) return <ErrorState title="Error" message={errorMessage(status.error, "Unknown error")} />

  const feeds = status.data ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("threat_intel.title")}</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {feeds.map((feed) => (
          <Card key={feed.source} className="p-4">
            <h2 className="text-lg font-semibold">
              {feed.source === "openphish"
                ? t("threat_intel.source.openphish")
                : t("threat_intel.source.urlhaus")}
            </h2>
            <p className="text-sm text-gray-500">
              {t("threat_intel.count")}: {feed.count}
            </p>
            <p className="text-sm text-gray-500">
              {t("threat_intel.last_sync")}:{" "}
              {feed.last_sync
                ? new Date(feed.last_sync * 1000).toLocaleString()
                : t("threat_intel.no_sync")}
            </p>
            <p className="text-sm text-gray-500">
              Status: {feed.status}
            </p>
          </Card>
        ))}
      </div>
      <div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          {t("threat_intel.refresh")}
        </Button>
      </div>
      <Card className="p-4">
        <div className="flex gap-2">
          <Input
            value={checkDomain}
            onChange={(e) => setCheckDomain(e.target.value)}
            placeholder={t("threat_intel.check_placeholder")}
          />
          <Button onClick={handleCheck}>Check</Button>
        </div>
        {checkResult && <p className="mt-2 text-sm">{checkResult}</p>}
      </Card>
    </div>
  )
}
