import type { PlanId } from "@amanak/shared-types"
import { useState } from "react"
import { Badge, Button, Card, ErrorState, Skeleton } from "../design/components"
import { IconCheck } from "../design/icons"
import { useT } from "../design/i18n"
import { api } from "../lib/api"
import { formatLimit, formatPrice, LIMIT_ROWS } from "../lib/plan"
import { errorMessage, useAsync } from "../lib/useAsync"

export function Pricing() {
  const t = useT()
  const plans = useAsync(() => api.getPlans())
  const sub = useAsync(() => api.getSubscription())
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly")
  const [busy, setBusy] = useState<PlanId | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const currentId = sub.data?.plan.id

  async function choose(id: PlanId) {
    setBusy(id)
    setMsg(null)
    try {
      await api.changePlan({ plan_id: id, period })
      setMsg(t("billing.changeSuccess"))
      sub.reload()
    } catch (err) {
      setMsg(errorMessage(err, t("common.error")))
    } finally {
      setBusy(null)
    }
  }

  if (plans.error) {
    return (
      <div className="amk-page">
        <ErrorState
          title={t("common.error")}
          message={errorMessage(plans.error, t("common.error"))}
          onRetry={plans.reload}
        />
      </div>
    )
  }

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{t("plans.title")}</h1>
          <p>{t("plans.subtitle")}</p>
        </div>
        <div className="amk-row">
          <Button
            variant={period === "monthly" ? "primary" : "secondary"}
            onClick={() => setPeriod("monthly")}
          >
            {t("plans.monthly")}
          </Button>
          <Button
            variant={period === "yearly" ? "primary" : "secondary"}
            onClick={() => setPeriod("yearly")}
          >
            {t("plans.yearly")}
          </Button>
        </div>
      </div>

      {msg && <div className="amk-alert amk-alert--info">{msg}</div>}

      {plans.loading && !plans.data ? (
        <div className="amk-grid amk-grid--three">
          <Skeleton height={220} />
          <Skeleton height={220} />
          <Skeleton height={220} />
        </div>
      ) : (
        <div className="amk-grid amk-grid--three">
          {(plans.data ?? []).map((plan) => {
            const isCurrent = plan.id === currentId
            return (
              <Card
                key={plan.id}
                padded
                elevated
                title={
                  <span className="amk-row">
                    {plan.name_en}
                    {isCurrent && <Badge variant="success">{t("plans.current")}</Badge>}
                  </span>
                }
              >
                <div className="amk-price">
                  ${formatPrice(plan, period)}
                  <span className="amk-muted">
                    {period === "yearly" ? t("plans.year") : t("plans.month")}
                  </span>
                </div>
                <p className="amk-muted">{t(`plans.tagline.${plan.id}`)}</p>
                <ul className="amk-feature-list">
                  {LIMIT_ROWS.map((row) => {
                    const value = plan.limits[row.key]
                    if (row.boolean) {
                      const on = Boolean(value)
                      return (
                        <li key={row.key} className={on ? "" : "amk-muted"}>
                          {on && <IconCheck size={14} />} {t(row.labelKey)}
                        </li>
                      )
                    }
                    return (
                      <li key={row.key}>
                        {t(row.labelKey)}: {formatLimit(Number(value), t)}
                      </li>
                    )
                  })}
                </ul>
                <Button
                  fullWidth
                  variant={isCurrent ? "secondary" : "primary"}
                  disabled={isCurrent}
                  loading={busy === plan.id}
                  onClick={() => choose(plan.id)}
                >
                  {isCurrent ? t("plans.currentPlan") : t("plans.select")}
                </Button>
              </Card>
            )
          })}
        </div>
      )}

      <div className="amk-row">
        <Button variant="ghost" onClick={() => window.location.assign("/billing")}>
          {t("plans.manage")}
        </Button>
      </div>
    </div>
  )
}
