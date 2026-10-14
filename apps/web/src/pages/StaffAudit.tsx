import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import type { AdminActionLogEntry } from "@amanak/shared-types"
import type { Column } from "../design/components"
import {
  Button,
  Card,
  DataTable,
  ErrorState,
  Input,
  JSONViewer,
  Modal,
  Skeleton,
} from "../design/components"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { api } from "../lib/api"
import { formatDateTime } from "../lib/format"
import { canSeeAudit, isForbidden } from "../lib/staff"
import { errorMessage, useAsync } from "../lib/useAsync"
import { useAuth } from "../state/AuthContext"

export function StaffAudit() {
  const t = useT()
  const { locale } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [actor, setActor] = useState("")
  const [action, setAction] = useState("")
  const [target, setTarget] = useState("")
  const [since, setSince] = useState("")
  const [until, setUntil] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AdminActionLogEntry | null>(null)

  const allowed = canSeeAudit(user)

  useEffect(() => {
    if (!allowed) navigate("/staff", { replace: true })
  }, [allowed, navigate])

  useEffect(() => {
    setPage(1)
  }, [actor, action, target, since, until])

  const list = useAsync(
    () => api.listAuditLog({ actor, action, target, since, until, page }),
    [actor, action, target, since, until, page],
  )

  const actionOptions = useMemo(() => {
    const set = new Set((list.data?.results ?? []).map((e) => e.action))
    return Array.from(set).sort()
  }, [list.data])

  const columns: Column<AdminActionLogEntry>[] = [
    {
      key: "created_at",
      header: t("staff.audit.timestamp"),
      render: (e) => formatDateTime(e.created_at, locale),
    },
    { key: "actor", header: t("staff.audit.actor"), render: (e) => e.actor_email ?? "—" },
    { key: "action", header: t("staff.audit.action"), render: (e) => e.action },
    { key: "target", header: t("staff.audit.target"), render: (e) => e.target_user ?? "—" },
    { key: "reason", header: t("staff.audit.reason"), render: (e) => e.reason || "—" },
    { key: "ip", header: t("staff.audit.ip"), render: (e) => e.ip ?? "—" },
  ]

  if (!allowed) return null

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{t("staff.audit.title")}</h1>
          <p>{t("staff.audit.subtitle")}</p>
        </div>
      </div>

      <Card padded elevated>
        <div className="amk-row">
          <Input
            label={t("staff.audit.actor")}
            value={actor}
            onChange={(e) => setActor(e.target.value)}
          />
          <div className="amk-field">
            <label className="amk-label" htmlFor="audit-action">
              {t("staff.audit.action")}
            </label>
            <select
              id="audit-action"
              className="amk-input"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="">{t("staff.audit.all")}</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <Input
            label={t("staff.audit.target")}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <Input
            type="date"
            label={t("staff.audit.dateFrom")}
            value={since}
            onChange={(e) => setSince(e.target.value)}
          />
          <Input
            type="date"
            label={t("staff.audit.dateTo")}
            value={until}
            onChange={(e) => setUntil(e.target.value)}
          />
        </div>
      </Card>

      {list.error ? (
        <ErrorState
          title={t("common.error")}
          message={errorMessage(list.error, t("common.error"))}
          onRetry={list.reload}
        />
      ) : (
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
              onRowClick={(e) => setSelected(e)}
              emptyLabel={t("staff.empty")}
            />
          )}
        </Card>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={t("staff.details")}
        actions={
          <Button variant="ghost" onClick={() => setSelected(null)}>
            {t("staff.close")}
          </Button>
        }
      >
        {selected && (
          <div className="amk-stack">
            <div className="amk-row">
              <strong>{selected.action}</strong>
              <span className="amk-muted">{formatDateTime(selected.created_at, locale)}</span>
            </div>
            <JSONViewer data={selected.before} label={t("staff.audit.before")} />
            <JSONViewer data={selected.after} label={t("staff.audit.after")} />
          </div>
        )}
      </Modal>
    </div>
  )
}
