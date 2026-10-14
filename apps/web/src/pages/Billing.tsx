import { useState } from "react"
import { Badge, Button, Card, ErrorState, Skeleton } from "../design/components"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { api } from "../lib/api"
import { formatDate } from "../lib/format"
import { formatLimit, usageEntry, USAGE_ROWS, usagePercent } from "../lib/plan"
import { errorMessage, useAsync } from "../lib/useAsync"

export function Billing() {
  const t = useT()
  const { locale } = useTheme()
  const sub = useAsync(() => api.getSubscription())
  const usage = useAsync(() => api.getBillingUsage())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function toggleCancel(action: "cancel" | "resume") {
    setBusy(true)
    setMsg(null)
    try {
      if (action === "cancel") await api.cancelSubscription()
      else await api.resumeSubscription()
      sub.reload()
    } catch (err) {
      setMsg(errorMessage(err, t("common.error")))
    } finally {
      setBusy(false)
    }
  }

  if (sub.error) {
    return (
      <div className="amk-page">
        <ErrorState
          title={t("common.error")}
          message={errorMessage(sub.error, t("common.error"))}
          onRetry={sub.reload}
        />
      </div>
    )
  }

  if (sub.loading && !sub.data) {
    return (
      <div className="amk-page">
        <Skeleton height={120} />
      </div>
    )
  }

  const s = sub.data
  if (!s) return null

  const planName = locale === "ar" ? s.plan.name_ar : s.plan.name_en

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{t("billing.title")}</h1>
          <p>{t("billing.subtitle")}</p>
        </div>
        <Button variant="secondary" onClick={() => window.location.assign("/plans")}>
          {t("billing.changePlan")}
        </Button>
      </div>

      {msg && <div className="amk-alert amk-alert--error">{msg}</div>}

      <div className="amk-grid amk-grid--two">
        <Card padded elevated title={t("billing.plan")}>
          <div className="amk-row">
            <strong>{planName}</strong>
            <Badge variant={s.status === "active" ? "success" : "warning"}>{s.status}</Badge>
            {s.cancel_at_period_end && (
              <Badge variant="warning">{t("billing.cancel_at_period_end")}</Badge>
            )}
          </div>
          <p className="amk-muted">
            {t("billing.period")}: {s.period === "yearly" ? t("plans.yearly") : t("plans.monthly")}
          </p>
          <p className="amk-muted">
            {t("billing.renews", { date: formatDate(s.current_period_end, locale) })}
          </p>
          <div className="amk-row">
            {s.cancel_at_period_end ? (
              <Button variant="primary" loading={busy} onClick={() => toggleCancel("resume")}>
                {t("billing.resume")}
              </Button>
            ) : (
              <Button variant="danger" loading={busy} onClick={() => toggleCancel("cancel")}>
                {t("billing.cancel")}
              </Button>
            )}
          </div>
        </Card>

        <Card padded elevated title={t("billing.usage")}>
          {usage.loading && !usage.data ? (
            <Skeleton height={120} />
          ) : (
            <ul className="amk-usage-list">
              {USAGE_ROWS.map((row) => {
                const entry = usageEntry(usage.data, row.key)
                const pct = usagePercent(entry)
                return (
                  <li key={row.key}>
                    <span className="amk-row amk-row--between">
                      <span>{t(row.labelKey)}</span>
                      <span className="amk-muted">
                        {entry.limit < 0
                          ? t("billing.unlimited")
                          : `${entry.used} / ${formatLimit(entry.limit, t)}`}
                      </span>
                    </span>
                    {pct !== null && entry.limit > 0 && (
                      <span className="amk-meter" aria-hidden="true">
                        <span className="amk-meter__fill" style={{ width: `${pct}%` }} />
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
