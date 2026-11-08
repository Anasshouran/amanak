import { useEffect, useMemo, useState } from "react"
import type { MouseEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import type { Column } from "../design/components"
import {
  Badge,
  Button,
  Card,
  DataTable,
  ErrorState,
  Input,
  Skeleton,
} from "../design/components"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { api } from "../lib/api"
import { formatDate } from "../lib/format"
import { isForbidden } from "../lib/staff"
import { errorMessage, useAsync } from "../lib/useAsync"

type Row = {
  id: number
  email: string
  username: string
  is_verified: boolean
  date_joined: string | null
  plan: string | null
  blocked: boolean
}

const PLAN_OPTIONS = ["free", "pro", "family"]

export function StaffUsers() {
  const t = useT()
  const { locale } = useTheme()
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("")
  const [plan, setPlan] = useState("")
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [query, status])

  const list = useAsync(async () => {
    const res = await api.listStaffUsers({ q: query, status, page })
    const rows: Row[] = res.results.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      is_verified: u.is_verified,
      date_joined: u.date_joined,
      plan: u.plan ?? null,
      blocked: u.is_blocked ?? false,
    }))
    return { count: res.count, pages: res.pages, rows }
  }, [query, status, page])

  useEffect(() => {
    if (isForbidden(list.error)) navigate("/staff", { replace: true })
  }, [list.error, navigate])

  const rows = useMemo(() => {
    if (!list.data) return []
    if (!plan) return list.data.rows
    return list.data.rows.filter((r) => r.plan === plan)
  }, [list.data, plan])

  function exportCsv() {
    const header = ["email", "username", "plan", "status", "verified", "created"]
    const lines = rows.map((r) =>
      [
        r.email,
        r.username,
        r.plan ?? "",
        r.blocked ? "blocked" : "active",
        r.is_verified ? "yes" : "no",
        r.date_joined ?? "",
      ].join(","),
    )
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "staff-users.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const columns: Column<Row>[] = [
    { key: "email", header: t("common.email"), render: (r) => r.email, sortable: true },
    { key: "plan", header: t("staff.users.plan"), render: (r) => r.plan ?? "—" },
    {
      key: "status",
      header: t("staff.users.status"),
      render: (r) =>
        r.blocked ? (
          <Badge variant="danger">{t("staff.users.blocked")}</Badge>
        ) : (
          <Badge variant="success">{t("staff.users.active")}</Badge>
        ),
    },
    {
      key: "verified",
      header: t("staff.users.verified"),
      render: (r) => (r.is_verified ? "✓" : "—"),
    },
    {
      key: "created",
      header: t("staff.users.created"),
      render: (r) => formatDate(r.date_joined, locale),
    },
    {
      key: "actions",
      header: t("staff.users.actions"),
      render: (r) => (
        <Link to={`/staff/users/${r.id}`} onClick={(e: MouseEvent) => e.stopPropagation()}>
          {t("staff.users.open")}
        </Link>
      ),
    },
  ]

  if (list.error && !isForbidden(list.error)) {
    return (
      <div className="amk-page">
        <ErrorState
          title={t("common.error")}
          message={errorMessage(list.error, t("common.error"))}
          onRetry={list.reload}
        />
      </div>
    )
  }

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{t("staff.users.title")}</h1>
          <p>{t("staff.users.subtitle")}</p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
          {t("staff.users.export")}
        </Button>
      </div>

      <Card padded elevated>
        <div className="amk-row">
          <Input
            label={t("staff.users.search")}
            placeholder={t("staff.users.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="amk-field">
            <label className="amk-label" htmlFor="staff-status">
              {t("staff.users.status")}
            </label>
            <select
              id="staff-status"
              className="amk-input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">{t("staff.users.allStatuses")}</option>
              <option value="blocked">{t("staff.users.blocked")}</option>
              <option value="active">{t("staff.users.active")}</option>
            </select>
          </div>
          <div className="amk-field">
            <label className="amk-label" htmlFor="staff-plan">
              {t("staff.users.plan")}
            </label>
            <select
              id="staff-plan"
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
        </div>
        <p className="amk-muted" style={{ fontSize: 12 }}>
          {t("staff.users.planFilterNote")} ·{" "}
          {t("staff.users.count", { count: list.data?.count ?? 0 })}
        </p>
      </Card>

      <Card padded elevated>
        {list.loading && !list.data ? (
          <Skeleton height={200} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            page={page}
            pages={list.data?.pages ?? 1}
            onPageChange={setPage}
            onRowClick={(r) => navigate(`/staff/users/${r.id}`)}
            emptyLabel={t("staff.empty")}
          />
        )}
      </Card>
    </div>
  )
}
