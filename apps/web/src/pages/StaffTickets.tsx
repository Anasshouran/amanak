import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import type { SupportTicket } from "@amanak/shared-types"
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
import { formatDateTime } from "../lib/format"
import { isForbidden } from "../lib/staff"
import { errorMessage, useAsync } from "../lib/useAsync"
import { useAuth } from "../state/AuthContext"

const STATUSES = ["open", "pending", "closed"]
const PRIORITIES = ["low", "normal", "high", "urgent"]

function statusVariant(status: string): "success" | "warning" | "info" | "danger" {
  if (status === "closed") return "success"
  if (status === "pending") return "warning"
  return "info"
}

export function StaffTickets() {
  const t = useT()
  const { locale } = useTheme()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [status, setStatus] = useState("")
  const [priority, setPriority] = useState("")
  const [assignee, setAssignee] = useState("")
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [status, priority, assignee])

  const list = useAsync(
    () =>
      api.listTickets({
        status,
        assigned_to: assignee === "me" && user ? String(user.id) : "",
        page,
      }),
    [status, assignee, page, user],
  )

  useEffect(() => {
    if (isForbidden(list.error)) navigate("/staff", { replace: true })
  }, [list.error, navigate])

  const rows = useMemo(() => {
    let result = list.data?.results ?? []
    if (priority) result = result.filter((ticket) => ticket.priority === priority)
    if (assignee === "unassigned") result = result.filter((ticket) => !ticket.assigned_to)
    return result
  }, [list.data, priority, assignee])

  const columns: Column<SupportTicket>[] = [
    { key: "id", header: "#", render: (r) => r.id },
    { key: "subject", header: t("staff.tickets.subject"), render: (r) => r.subject },
    { key: "user", header: t("staff.user"), render: (r) => r.user_email ?? "—" },
    {
      key: "status",
      header: t("staff.tickets.status"),
      render: (r) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge>,
    },
    { key: "priority", header: t("staff.tickets.priority"), render: (r) => r.priority },
    {
      key: "assignee",
      header: t("staff.tickets.assignee"),
      render: (r) => (r.assigned_to ? `#${r.assigned_to}` : t("staff.tickets.unassigned")),
    },
    {
      key: "created",
      header: t("staff.tickets.created"),
      render: (r) => formatDateTime(r.created_at, locale),
    },
  ]

  async function onCreate() {
    if (!subject.trim() || !body.trim()) return
    setBusy(true)
    try {
      await api.createTicket({ subject: subject.trim(), body: body.trim() })
      toast.push(t("staff.tickets.createdOk"), "success")
      setOpen(false)
      setSubject("")
      setBody("")
      list.reload()
    } catch (err) {
      toast.push(errorMessage(err, t("common.error")), "error")
    } finally {
      setBusy(false)
    }
  }

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
          <h1>{t("staff.tickets.title")}</h1>
          <p>{t("staff.tickets.subtitle")}</p>
        </div>
        <Button onClick={() => setOpen(true)}>{t("staff.tickets.new")}</Button>
      </div>

      <Card padded elevated>
        <div className="amk-row">
          <div className="amk-field">
            <label className="amk-label" htmlFor="ticket-status">
              {t("staff.tickets.status")}
            </label>
            <select
              id="ticket-status"
              className="amk-input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">{t("staff.all")}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`staff.tickets.status.${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="amk-field">
            <label className="amk-label" htmlFor="ticket-priority">
              {t("staff.tickets.priority")}
            </label>
            <select
              id="ticket-priority"
              className="amk-input"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="">{t("staff.all")}</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`staff.tickets.priority.${p}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="amk-field">
            <label className="amk-label" htmlFor="ticket-assignee">
              {t("staff.tickets.assignee")}
            </label>
            <select
              id="ticket-assignee"
              className="amk-input"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">{t("staff.all")}</option>
              <option value="me">{t("staff.tickets.me")}</option>
              <option value="unassigned">{t("staff.tickets.unassigned")}</option>
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
            rows={rows}
            page={page}
            pages={list.data?.pages ?? 1}
            onPageChange={setPage}
            onRowClick={(r) => navigate(`/staff/tickets/${r.id}`)}
            emptyLabel={t("staff.empty")}
          />
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("staff.tickets.new")}
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("staff.cancel")}
            </Button>
            <Button onClick={onCreate} loading={busy} disabled={!subject.trim() || !body.trim()}>
              {t("staff.tickets.create")}
            </Button>
          </>
        }
      >
        <Input
          label={t("staff.tickets.subject")}
          placeholder={t("staff.tickets.subjectPlaceholder")}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <Textarea
          label={t("staff.tickets.body")}
          placeholder={t("staff.tickets.bodyPlaceholder")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Modal>
    </div>
  )
}
