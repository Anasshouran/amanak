import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
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
import { formatDate, formatDateTime } from "../lib/format"
import { setImpersonation } from "../lib/impersonation"
import {
  canBlockUsers,
  canChangeBilling,
  canExportUser,
  canImpersonate,
  canManageTickets,
  isForbidden,
} from "../lib/staff"
import { errorMessage, useAsync } from "../lib/useAsync"
import { useAuth } from "../state/AuthContext"

export function StaffUserDetail() {
  const t = useT()
  const { locale } = useTheme()
  const { id } = useParams()
  const userId = Number(id)
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [blockOpen, setBlockOpen] = useState(false)
  const [unblockOpen, setUnblockOpen] = useState(false)
  const [impersonateOpen, setImpersonateOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [behalfOpen, setBehalfOpen] = useState(false)
  const [impersonateReason, setImpersonateReason] = useState("")
  const [exportReason, setExportReason] = useState("")
  const [exportConfirmEmail, setExportConfirmEmail] = useState("")
  const [behalfSubject, setBehalfSubject] = useState("")
  const [behalfBody, setBehalfBody] = useState("")
  const [busy, setBusy] = useState(false)

  const snap = useAsync(() => api.getStaffUser(userId), [userId])
  const tickets = useAsync(() => api.listTickets({ page: 1 }), [userId])

  const userTickets = useMemo(
    () => (tickets.data?.results ?? []).filter((ticket) => ticket.user === userId),
    [tickets.data, userId],
  )

  useEffect(() => {
    if (isForbidden(snap.error)) navigate("/staff", { replace: true })
  }, [snap.error, navigate])

  if (snap.error) {
    return (
      <div className="amk-page">
        <ErrorState
          title={t("common.error")}
          message={errorMessage(snap.error, t("common.error"))}
          onRetry={snap.reload}
        />
      </div>
    )
  }

  if (snap.loading && !snap.data) {
    return (
      <div className="amk-page">
        <Skeleton height={200} />
      </div>
    )
  }

  const s = snap.data
  if (!s) return null

  async function onBlock(reason?: string) {
    if (!reason || !reason.trim()) {
      toast.push(t("staff.block.reasonRequired"), "error")
      return
    }
    setBusy(true)
    try {
      await api.blockStaffUser(userId, reason.trim())
      toast.push(t("staff.block.success"), "success")
      setBlockOpen(false)
      snap.reload()
    } catch (err) {
      toast.push(errorMessage(err, t("staff.block.fail")), "error")
    } finally {
      setBusy(false)
    }
  }

  async function onUnblock(reason?: string) {
    setBusy(true)
    try {
      await api.unblockStaffUser(userId, (reason ?? "").trim())
      toast.push(t("staff.unblock.success"), "success")
      setUnblockOpen(false)
      snap.reload()
    } catch (err) {
      toast.push(errorMessage(err, t("staff.unblock.fail")), "error")
    } finally {
      setBusy(false)
    }
  }

  async function onImpersonate() {
    if (impersonateReason.trim().length < 10) {
      toast.push(t("staff.impersonate.reasonRequired"), "error")
      return
    }
    setBusy(true)
    try {
      const res = await api.impersonateUser(userId, impersonateReason.trim())
      setImpersonation({
        userId: res.target.id,
        email: res.target.email,
        sessionId: res.session_id,
        expiresAt: Date.parse(res.expires_at),
      })
      setImpersonateOpen(false)
      setImpersonateReason("")
      toast.push(t("staff.impersonate.started"), "success")
      navigate("/")
    } catch (err) {
      toast.push(errorMessage(err, t("staff.impersonate.fail")), "error")
    } finally {
      setBusy(false)
    }
  }

  async function onExport() {
    if (exportConfirmEmail.trim().toLowerCase() !== (s?.user.email ?? "").toLowerCase()) {
      toast.push(t("staff.export.emailMismatch"), "error")
      return
    }
    setBusy(true)
    try {
      const req = await api.requestUserExport(userId, exportReason.trim())
      const doc = await api.downloadUserExport(req.token)
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `amanak-export-${userId}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.push(t("staff.export.done"), "success")
      setExportOpen(false)
      setExportConfirmEmail("")
      setExportReason("")
    } catch (err) {
      toast.push(errorMessage(err, t("staff.export.fail")), "error")
    } finally {
      setBusy(false)
    }
  }

  async function onBehalf() {
    if (!behalfSubject.trim() || !behalfBody.trim()) return
    setBusy(true)
    try {
      await api.createTicket({
        subject: behalfSubject.trim(),
        body: behalfBody.trim(),
        target_user_id: userId,
      })
      toast.push(t("staff.detail.behalfDone"), "success")
      setBehalfOpen(false)
      setBehalfSubject("")
      setBehalfBody("")
      tickets.reload()
    } catch (err) {
      toast.push(errorMessage(err, t("staff.detail.behalfFail")), "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{s.user.email}</h1>
          <p>
            {s.moderation.is_blocked ? (
              <Badge variant="danger">{t("staff.detail.blockedBadge")}</Badge>
            ) : (
              <Badge variant="success">{t("staff.detail.activeBadge")}</Badge>
            )}
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate("/staff/users")}>
          {t("staff.back")}
        </Button>
      </div>

      <div className="amk-grid amk-grid--two">
        <Card padded elevated title={t("staff.detail.account")}>
          <ul className="amk-list">
            <li className="amk-listitem">
              <span>{t("common.email")}</span>
              <span>{s.user.email}</span>
            </li>
            <li className="amk-listitem">
              <span>{t("common.user")}</span>
              <span>{s.user.username}</span>
            </li>
            <li className="amk-listitem">
              <span>{t("staff.detail.created")}</span>
              <span>{formatDate(s.user.date_joined, locale)}</span>
            </li>
            <li className="amk-listitem">
              <span>{t("staff.users.verified")}</span>
              <span>{s.user.is_verified ? "✓" : "—"}</span>
            </li>
          </ul>
        </Card>

        <Card padded elevated title={t("staff.detail.moderation")}>
          <p>
            {s.moderation.is_blocked ? (
              <Badge variant="danger">{t("staff.detail.blockedBadge")}</Badge>
            ) : (
              <Badge variant="success">{t("staff.detail.activeBadge")}</Badge>
            )}
          </p>
          {s.moderation.reason && <p className="amk-muted">{s.moderation.reason}</p>}
          <div className="amk-row">
            {canBlockUsers(user) &&
              (s.moderation.is_blocked ? (
                <Button variant="secondary" onClick={() => setUnblockOpen(true)} disabled={busy}>
                  {t("staff.detail.unblock")}
                </Button>
              ) : (
                <Button variant="danger" onClick={() => setBlockOpen(true)} disabled={busy}>
                  {t("staff.detail.block")}
                </Button>
              ))}
            {canChangeBilling(user) && (
              <Link className="amk-btn amk-btn--secondary amk-btn--md" to="/staff/subscriptions">
                {t("staff.detail.changePlan")}
              </Link>
            )}
            {canImpersonate(user) && !s.user.is_staff && (
              <Button
                variant="secondary"
                onClick={() => setImpersonateOpen(true)}
                disabled={busy}
              >
                {t("staff.detail.impersonate")}
              </Button>
            )}
            {canManageTickets(user) && (
              <Button
                variant="ghost"
                onClick={() => setBehalfOpen(true)}
                disabled={busy}
              >
                {t("staff.detail.openTicket")}
              </Button>
            )}
            {canExportUser(user) && (
              <Button variant="ghost" onClick={() => setExportOpen(true)} disabled={busy}>
                {t("staff.detail.export")}
              </Button>
            )}
            <a
              className="amk-btn amk-btn--ghost amk-btn--md"
              href={`/admin/accounts/user/${userId}/change/`}
              target="_blank"
              rel="noreferrer"
            >
              {t("staff.detail.viewAdmin")}
            </a>
          </div>
        </Card>

        <Card padded elevated title={t("staff.detail.subscription")}>
          <ul className="amk-list">
            <li className="amk-listitem">
              <span>{t("staff.users.plan")}</span>
              <span>{s.subscription.plan ?? "—"}</span>
            </li>
            <li className="amk-listitem">
              <span>{t("staff.status")}</span>
              <span>{s.subscription.status ?? "—"}</span>
            </li>
            <li className="amk-listitem">
              <span>{t("staff.date")}</span>
              <span>{formatDate(s.subscription.current_period_end, locale)}</span>
            </li>
          </ul>
          {canChangeBilling(user) && (
            <Link className="amk-btn amk-btn--secondary amk-btn--md" to="/staff/users">
              {t("staff.detail.changePlan")}
            </Link>
          )}
        </Card>

        <Card padded elevated title={t("staff.detail.usage")}>
          <ul className="amk-list">
            <li className="amk-listitem">
              <span>{t("staff.detail.scans")}</span>
              <span>
                {s.usage_this_month.scans.used} / {s.usage_this_month.scans.limit}
              </span>
            </li>
            <li className="amk-listitem">
              <span>AI</span>
              <span>
                {s.usage_this_month.ai_requests.used} / {s.usage_this_month.ai_requests.limit}
              </span>
            </li>
          </ul>
        </Card>

        <Card padded elevated title={t("staff.detail.counts")}>
          <ul className="amk-list">
            <li className="amk-listitem">
              <span>{t("staff.detail.scans")}</span>
              <span>{s.counts.scans_total}</span>
            </li>
            <li className="amk-listitem">
              <span>{t("staff.detail.incidents")}</span>
              <span>{s.counts.incidents_total}</span>
            </li>
            <li className="amk-listitem">
              <span>{t("staff.detail.vault")}</span>
              <span>{s.counts.vault_entries}</span>
            </li>
            <li className="amk-listitem">
              <span>{t("staff.detail.twofa")}</span>
              <span>{s.counts["2fa_entries"]}</span>
            </li>
          </ul>
          <p className="amk-muted" style={{ fontSize: 12 }}>
            {t("staff.detail.scansNote")}
          </p>
        </Card>

        <Card padded elevated title={t("staff.detail.tickets")}>
          {userTickets.length === 0 ? (
            <p className="amk-muted">{t("staff.detail.noTickets")}</p>
          ) : (
            <ul className="amk-list">
              {userTickets.map((ticket) => (
                <li key={ticket.id} className="amk-listitem">
                  <Link to={`/staff/tickets/${ticket.id}`}>{ticket.subject}</Link>
                  <span className="amk-muted" style={{ fontSize: 12 }}>
                    {formatDateTime(ticket.created_at, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmModal
        open={blockOpen}
        title={t("staff.block.title")}
        description={t("staff.block.message", { email: s.user.email })}
        confirmText={t("staff.block.confirm")}
        cancelText={t("staff.cancel")}
        requireReason
        reasonMin={3}
        onConfirm={onBlock}
        onClose={() => setBlockOpen(false)}
      />
      <ConfirmModal
        open={unblockOpen}
        title={t("staff.unblock.title")}
        description={t("staff.unblock.message", { email: s.user.email })}
        confirmText={t("staff.unblock.confirm")}
        cancelText={t("staff.cancel")}
        requireReason
        reasonMin={3}
        onConfirm={onUnblock}
        onClose={() => setUnblockOpen(false)}
      />

      <Modal
        open={impersonateOpen}
        onClose={() => setImpersonateOpen(false)}
        title={t("staff.impersonate.title")}
      >
        <p className="amk-muted">{t("staff.impersonate.message", { email: s.user.email })}</p>
        <div className="amk-field">
          <Textarea
            label={t("staff.reason")}
            value={impersonateReason}
            rows={3}
            onChange={(e) => setImpersonateReason(e.target.value)}
          />
        </div>
        <div className="amk-modal__actions">
          <Button variant="ghost" onClick={() => setImpersonateOpen(false)}>
            {t("staff.cancel")}
          </Button>
          <Button
            onClick={() => void onImpersonate()}
            disabled={busy || impersonateReason.trim().length < 10}
          >
            {t("staff.impersonate.start")}
          </Button>
        </div>
      </Modal>

      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title={t("staff.export.title")}
      >
        <p className="amk-muted">{t("staff.export.message", { email: s.user.email })}</p>
        <div className="amk-field">
          <Textarea
            label={t("staff.reason")}
            value={exportReason}
            rows={2}
            onChange={(e) => setExportReason(e.target.value)}
          />
        </div>
        <div className="amk-field">
          <Input
            label={t("staff.export.confirmLabel", { email: s.user.email })}
            value={exportConfirmEmail}
            onChange={(e) => setExportConfirmEmail(e.target.value)}
            placeholder={s.user.email}
          />
        </div>
        <div className="amk-modal__actions">
          <Button variant="ghost" onClick={() => setExportOpen(false)}>
            {t("staff.cancel")}
          </Button>
          <Button onClick={() => void onExport()} disabled={busy}>
            {t("staff.export.download")}
          </Button>
        </div>
      </Modal>

      <Modal
        open={behalfOpen}
        onClose={() => setBehalfOpen(false)}
        title={t("staff.detail.openTicket")}
      >
        <p className="amk-muted">{t("staff.detail.behalfNote")}</p>
        <div className="amk-field">
          <Input
            label={t("staff.tickets.subject")}
            value={behalfSubject}
            onChange={(e) => setBehalfSubject(e.target.value)}
            placeholder={t("staff.tickets.subjectPlaceholder")}
          />
        </div>
        <div className="amk-field">
          <Textarea
            label={t("staff.tickets.body")}
            value={behalfBody}
            rows={4}
            onChange={(e) => setBehalfBody(e.target.value)}
            placeholder={t("staff.tickets.bodyPlaceholder")}
          />
        </div>
        <div className="amk-modal__actions">
          <Button variant="ghost" onClick={() => setBehalfOpen(false)}>
            {t("staff.cancel")}
          </Button>
          <Button
            onClick={() => void onBehalf()}
            disabled={busy || !behalfSubject.trim() || !behalfBody.trim()}
          >
            {t("staff.tickets.create")}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
