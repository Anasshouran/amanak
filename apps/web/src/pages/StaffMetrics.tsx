import { useState } from "react"
import { BarChart, Button, Card, ErrorState, Skeleton } from "../design/components"
import { useT } from "../design/i18n"
import { api } from "../lib/api"
import { canSeeAudit, fetchAllPages } from "../lib/staff"
import { errorMessage, useAsync } from "../lib/useAsync"
import { useAuth } from "../state/AuthContext"

const RANGES: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 }

function bucket(dates: string[], days: number): { label: string; value: number }[] {
  const counts = new Map<string, number>()
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    counts.set(d.toISOString().slice(0, 10), 0)
  }
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  for (const iso of dates) {
    if (!iso) continue
    const key = iso.slice(0, 10)
    if (key >= cutoff && counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return Array.from(counts.entries()).map(([key, value]) => ({
    label: key.slice(5),
    value,
  }))
}

export function StaffMetrics() {
  const t = useT()
  const { user } = useAuth()
  const [range, setRange] = useState("30d")
  const days = RANGES[range] ?? 30

  const metrics = useAsync(async () => {
    const [users, tickets, audit] = await Promise.all([
      fetchAllPages((page) => api.listStaffUsers({ page }), 10),
      fetchAllPages((page) => api.listTickets({ page }), 10),
      canSeeAudit(user) ? fetchAllPages((page) => api.listAuditLog({ page }), 10) : Promise.resolve([]),
    ])
    return { users, tickets, audit }
  }, [user])

  if (metrics.error) {
    return (
      <div className="amk-page">
        <ErrorState
          title={t("common.error")}
          message={errorMessage(metrics.error, t("common.error"))}
          onRetry={metrics.reload}
        />
      </div>
    )
  }

  if (metrics.loading && !metrics.data) {
    return (
      <div className="amk-page">
        <Skeleton height={200} />
      </div>
    )
  }

  const data = metrics.data
  if (!data) return null

  const signups = bucket(
    data.users.map((u) => u.date_joined ?? ""),
    days,
  )
  const opened = bucket(
    data.tickets.map((tk) => tk.created_at),
    days,
  )
  const blocks = bucket(
    data.audit.filter((a) => a.action === "user.block").map((a) => a.created_at),
    days,
  )

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{t("staff.metrics.title")}</h1>
          <p>{t("staff.metrics.subtitle")}</p>
        </div>
        <div className="amk-row">
          {Object.keys(RANGES).map((key) => (
            <Button
              key={key}
              variant={range === key ? "primary" : "secondary"}
              size="sm"
              onClick={() => setRange(key)}
            >
              {t(`staff.metrics.${key}`)}
            </Button>
          ))}
        </div>
      </div>

      <div className="amk-grid amk-grid--two">
        <Card padded elevated title={t("staff.metrics.signups")}>
          <BarChart data={signups} />
        </Card>
        <Card padded elevated title={t("staff.metrics.ticketsOpened")}>
          <BarChart data={opened} />
        </Card>
        {canSeeAudit(user) && (
          <Card padded elevated title={t("staff.metrics.blocked")}>
            <BarChart data={blocks} />
          </Card>
        )}
        <Card padded elevated title={t("staff.metrics.scans")}>
          <p className="amk-muted">{t("staff.metrics.unavailable")}</p>
        </Card>
        <Card padded elevated title={t("staff.metrics.byPlan")}>
          <p className="amk-muted">{t("staff.metrics.unavailable")}</p>
        </Card>
      </div>
    </div>
  )
}
