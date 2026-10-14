import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import type { StaffSubscriptionRow } from "@amanak/shared-types"
import type { Column } from "../design/components"
import {
  Badge,
  Button,
  Card,
  DataTable,
  ErrorState,
  Input,
  Modal,
  Skeleton,
  Textarea,
  useToast,
} from "../design/components"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { api } from "../lib/api"
import { formatDate } from "../lib/format"
import { isForbidden } from "../lib/staff"
import { errorMessage, useAsync } from "../lib/useAsync"

const PLAN_OPTIONS = ["free", "pro", "family"]
const STATUS_OPTIONS = ["active", "trialing", "past_due", "canceled", "expired"]
const PERIOD_OPTIONS = ["monthly", "yearly"]

function statusVariant(status: string) {
  if (status === "active") return "success" as const
  if (status === "past_due") return "danger" as const
  if (status === "trialing") return "info" as const
  return "neutral" as const
}

export function StaffSubscriptions() {
  const t = useT()
  const { locale } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const [search, setSearch] = useState("")
  const [plan, setPlan] = useState("")
  const [status, setStatus] = useState("")
  const [period, setPeriod] = useState("")
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<StaffSubscriptionRow | null>(null)
  const [form, setForm] = useState({ plan_id: "free", period: "monthly", reason: "" })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [query, plan, status, period])

  const list = useAsync(
    () => api.listStaffSubscriptions({ q: query, plan, status, period, page }),
    [query, plan, status, period, page],
  )

  useEffect(() => {
    if (isForbidden(list.error)) navigate("/staff", { replace: true })
  }, [list.error, navigate])

  function openChange(row: StaffSubscriptionRow) {
    setEditing(row)
    setForm({ plan_id: row.plan, period: row.period, reason: "" })
  }

  async function submitChange() {
    if (!editing) return
    if (form.reason.trim().length < 3) {
      toast.push(t("staff.subscriptions.reasonRequired"), "error")
      return
    }
    setBusy(true)
    try {
      await api.changeStaffSubscription(editing.user_id, {
        plan_id: form.plan_id,
        period: form.period,
        reason: form.reason.trim(),
      })
      toast.push(t("staff.subscriptions.changed"), "success")
      setEditing(null)
      list.reload()
    } catch (err) {
      toast.push(errorMessage(err, t("common.error")), "error")
    } finally {
      setBusy(false)
    }
  }

  const columns: Column<StaffSubscriptionRow>[] = [
    { key: "email", header: t("common.email"), render: (r) => r.email, sortable: true },
    { key: "plan", header: t("billing.plan"), render: (r) => r.plan },
    {
      key: "status",
      header: t("billing.status"),
      render: (r) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge>,
    },
    { key: "period", header: t("billing.period"), render: (r) => r.period },
    {
      key: "period_end",
      header: t("staff.subscriptions.periodEnd"),
      render: (r) => formatDate(r.current_period_end, locale),
    },
    {
      key: "actions",
      header: t("staff.users.actions"),
      render: (r) => (
        <div className="amk-row" onClick={(e) => e.stopPropagation()} style={{ gap: 8 }}>
          <button type="button" className="amk-linklike" onClick={() => openChange(r)}>
            {t("staff.subscriptions.change")}
          </button>
          <Link to={`/staff/users/${r.user_id}`}>{t("staff.subscriptions.viewUser")}</Link>
        </div>
      ),
    },
  ]

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{t("staff.subscriptions.title")}</h1>
          <p>{t("staff.subscriptions.subtitle")}</p>
        </div>
      </div>

      {list.error ? (
        <ErrorState
          title={t("common.error")}
          message={errorMessage(list.error, t("common.error"))}
          onRetry={list.reload}
        />
      ) : (
        <>
          <Card padded elevated>
            <div className="amk-row">
              <Input
                label={t("staff.users.search")}
                placeholder={t("staff.users.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="amk-field">
                <label className="amk-label" htmlFor="sub-plan">
                  {t("billing.plan")}
                </label>
                <select
                  id="sub-plan"
                  className="amk-input"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                >
                  <option value="">{t("staff.users.allPlans")}</option>
                  {PLAN_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="amk-field">
                <label className="amk-label" htmlFor="sub-status">
                  {t("billing.status")}
                </label>
                <select
                  id="sub-status"
                  className="amk-input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">{t("staff.users.allStatuses")}</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="amk-field">
                <label className="amk-label" htmlFor="sub-period">
                  {t("billing.period")}
                </label>
                <select
                  id="sub-period"
                  className="amk-input"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  <option value="">{t("staff.all")}</option>
                  {PERIOD_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <Card padded elevated>
            {list.loading && !list.data ? (
              <Skeleton height={200} />
            ) : (
              <DataTable
                columns={columns}
                rows={list.data?.results ?? []}
                page={page}
                pages={list.data?.pages ?? 1}
                onPageChange={setPage}
                emptyLabel={t("staff.empty")}
              />
            )}
          </Card>
        </>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t("staff.subscriptions.change")}
      >
        <p className="amk-muted">{editing?.email}</p>
        <div className="amk-field">
          <label className="amk-label" htmlFor="change-plan">
            {t("billing.plan")}
          </label>
          <select
            id="change-plan"
            className="amk-input"
            value={form.plan_id}
            onChange={(e) => setForm({ ...form, plan_id: e.target.value })}
          >
            {PLAN_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="amk-field">
          <label className="amk-label" htmlFor="change-period">
            {t("billing.period")}
          </label>
          <select
            id="change-period"
            className="amk-input"
            value={form.period}
            onChange={(e) => setForm({ ...form, period: e.target.value })}
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <Textarea
          label={t("staff.reason")}
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
        />
        <div className="amk-modal__actions">
          <Button variant="ghost" onClick={() => setEditing(null)}>
            {t("staff.cancel")}
          </Button>
          <Button onClick={() => void submitChange()} disabled={busy}>
            {t("staff.subscriptions.confirm")}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
