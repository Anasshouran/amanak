import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Skeleton,
  Textarea,
  useToast,
} from "../design/components"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { api } from "../lib/api"
import { formatDateTime } from "../lib/format"
import { canManageTickets, isForbidden } from "../lib/staff"
import { errorMessage, useAsync } from "../lib/useAsync"
import { useAuth } from "../state/AuthContext"

const STATUSES = ["open", "pending", "closed"]
const PRIORITIES = ["low", "normal", "high", "urgent"]

export function StaffTicketDetail() {
  const t = useT()
  const { locale } = useTheme()
  const { id } = useParams()
  const ticketId = Number(id)
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [reply, setReply] = useState("")
  const [busy, setBusy] = useState(false)

  const ticket = useAsync(() => api.getTicket(ticketId), [ticketId])
  const staffList = useAsync(
    () => (canManageTickets(user) ? api.listStaffUsers({ page: 1 }) : Promise.resolve(null)),
    [user],
  )

  useEffect(() => {
    if (isForbidden(ticket.error)) navigate("/staff/tickets", { replace: true })
  }, [ticket.error, navigate])

  if (ticket.error) {
    return (
      <div className="amk-page">
        <ErrorState
          title={t("common.error")}
          message={errorMessage(ticket.error, t("common.error"))}
          onRetry={ticket.reload}
        />
      </div>
    )
  }

  if (ticket.loading && !ticket.data) {
    return (
      <div className="amk-page">
        <Skeleton height={200} />
      </div>
    )
  }

  const tk = ticket.data
  if (!tk) return null
  const staff = canManageTickets(user)

  async function patch(update: { status?: string; priority?: string; assigned_to?: number | null }) {
    setBusy(true)
    try {
      await api.updateTicket(ticketId, update)
      ticket.reload()
    } catch (err) {
      toast.push(errorMessage(err, t("common.error")), "error")
    } finally {
      setBusy(false)
    }
  }

  async function sendReply() {
    if (!reply.trim()) return
    setBusy(true)
    try {
      await api.addTicketMessage(ticketId, reply.trim())
      setReply("")
      ticket.reload()
    } catch (err) {
      toast.push(errorMessage(err, t("common.error")), "error")
    } finally {
      setBusy(false)
    }
  }

  const assignees = (staffList.data?.results ?? []).filter((u) => u.is_staff)

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{tk.subject}</h1>
          <p className="amk-muted">
            #{tk.id} · {tk.user_email} · {formatDateTime(tk.created_at, locale)}
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate("/staff/tickets")}>
          {t("staff.back")}
        </Button>
      </div>

      <div className="amk-grid amk-grid--two">
        <Card padded elevated title={t("staff.ticket.thread")}>
          <div className="amk-stack">
            <div className="amk-listitem">
              <div>
                <strong>{tk.user_email ?? t("staff.ticket.customer")}</strong>
                <p>{tk.body}</p>
              </div>
            </div>
            {tk.messages.map((m) => (
              <div key={m.id} className="amk-listitem">
                <div>
                  <strong>{m.is_staff ? t("staff.ticket.you") : m.author_email}</strong>
                  <span className="amk-muted" style={{ fontSize: 12 }}>
                    {" "}
                    {formatDateTime(m.created_at, locale)}
                  </span>
                  <p>{m.body}</p>
                </div>
              </div>
            ))}
            {tk.messages.length === 0 && <p className="amk-muted">{t("staff.ticket.noMessages")}</p>}
          </div>
          {staff && (
            <div className="amk-stack" style={{ marginTop: 16 }}>
              <Textarea
                label={t("staff.ticket.reply")}
                placeholder={t("staff.ticket.replyPlaceholder")}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <div>
                <Button onClick={sendReply} loading={busy} disabled={!reply.trim()}>
                  {t("staff.ticket.send")}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {staff && (
          <Card padded elevated title={t("staff.ticket.actions")}>
            <div className="amk-field">
              <label className="amk-label" htmlFor="d-status">
                {t("staff.tickets.status")}
              </label>
              <select
                id="d-status"
                className="amk-input"
                value={tk.status}
                disabled={busy}
                onChange={(e) => patch({ status: e.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`staff.tickets.status.${s}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="amk-field">
              <label className="amk-label" htmlFor="d-priority">
                {t("staff.tickets.priority")}
              </label>
              <select
                id="d-priority"
                className="amk-input"
                value={tk.priority}
                disabled={busy}
                onChange={(e) => patch({ priority: e.target.value })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`staff.tickets.priority.${p}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="amk-field">
              <label className="amk-label" htmlFor="d-assignee">
                {t("staff.ticket.assignTo")}
              </label>
              <select
                id="d-assignee"
                className="amk-input"
                value={tk.assigned_to ?? ""}
                disabled={busy}
                onChange={(e) =>
                  patch({ assigned_to: e.target.value ? Number(e.target.value) : null })
                }
              >
                <option value="">{t("staff.tickets.unassigned")}</option>
                {user && <option value={user.id}>{t("staff.tickets.me")}</option>}
                {assignees
                  .filter((a) => a.id !== user?.id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.email}
                    </option>
                  ))}
              </select>
            </div>
            <p>
              <Badge variant="info">{tk.status}</Badge>
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
