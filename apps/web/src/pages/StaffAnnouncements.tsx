import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import type { AnnouncementAudience } from "@amanak/shared-types"
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Input,
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

const PLAN_OPTIONS = ["free", "pro", "family"]
type AudienceType = "all" | "plan" | "verified"

export function StaffAnnouncements() {
  const t = useT()
  const { locale } = useTheme()
  const toast = useToast()
  const navigate = useNavigate()

  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [audienceType, setAudienceType] = useState<AudienceType>("all")
  const [planValue, setPlanValue] = useState("pro")
  const [createdId, setCreatedId] = useState<number | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const list = useAsync(() => api.listAnnouncements({ page: 1 }), [])

  useEffect(() => {
    if (isForbidden(list.error)) navigate("/staff", { replace: true })
  }, [list.error, navigate])

  function audience(): AnnouncementAudience {
    if (audienceType === "plan") return { plan: planValue }
    if (audienceType === "verified") return { verified: true }
    return { all: true }
  }

  function resetComposer() {
    setSubject("")
    setBody("")
    setAudienceType("all")
    setPlanValue("pro")
    setCreatedId(null)
    setCount(null)
  }

  function invalidateDraft() {
    setCreatedId(null)
    setCount(null)
  }

  async function ensureDraft(): Promise<number | null> {
    if (createdId !== null) return createdId
    if (!subject.trim() || !body.trim()) {
      toast.push(t("staff.announcements.invalid"), "error")
      return null
    }
    const created = await api.createAnnouncement({
      subject: subject.trim(),
      body: body.trim(),
      audience: audience(),
    })
    setCreatedId(created.id)
    return created.id
  }

  async function onPreview() {
    setBusy(true)
    try {
      const id = await ensureDraft()
      if (id === null) return
      const res = await api.previewAnnouncement(id)
      setCount(res.recipient_count)
    } catch (err) {
      toast.push(errorMessage(err, t("common.error")), "error")
    } finally {
      setBusy(false)
    }
  }

  async function onSend() {
    setBusy(true)
    try {
      const id = await ensureDraft()
      if (id === null) return
      await api.sendAnnouncement(id)
      toast.push(t("staff.announcements.sent"), "success")
      setConfirmOpen(false)
      resetComposer()
      list.reload()
    } catch (err) {
      toast.push(errorMessage(err, t("common.error")), "error")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{t("staff.announcements.title")}</h1>
          <p>{t("staff.announcements.subtitle")}</p>
        </div>
      </div>

      <Card padded elevated title={t("staff.announcements.compose")}>
        <div className="amk-field">
          <Input
            id="ann-subject"
            label={t("staff.tickets.subject")}
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value)
              invalidateDraft()
            }}
          />
        </div>
        <div className="amk-field">
          <Textarea
            label={t("staff.announcements.body")}
            value={body}
            rows={5}
            onChange={(e) => {
              setBody(e.target.value)
              invalidateDraft()
            }}
          />
        </div>
        <div className="amk-row">
          <div className="amk-field">
            <label className="amk-label" htmlFor="ann-audience">
              {t("staff.announcements.audience")}
            </label>
            <select
              id="ann-audience"
              className="amk-input"
              value={audienceType}
              onChange={(e) => {
                setAudienceType(e.target.value as AudienceType)
                invalidateDraft()
              }}
            >
              <option value="all">{t("staff.announcements.audience.all")}</option>
              <option value="plan">{t("staff.announcements.audience.plan")}</option>
              <option value="verified">{t("staff.announcements.audience.verified")}</option>
            </select>
          </div>
          {audienceType === "plan" && (
            <div className="amk-field">
              <label className="amk-label" htmlFor="ann-plan">
                {t("billing.plan")}
              </label>
              <select
                id="ann-plan"
                className="amk-input"
                value={planValue}
                onChange={(e) => {
                  setPlanValue(e.target.value)
                  invalidateDraft()
                }}
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="amk-row">
          <Button variant="secondary" onClick={() => void onPreview()} disabled={busy}>
            {t("staff.announcements.preview")}
          </Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)} disabled={busy}>
            {t("staff.announcements.send")}
          </Button>
          {count !== null && (
            <span className="amk-muted" role="status">
              {t("staff.announcements.recipients", { count })}
            </span>
          )}
        </div>
      </Card>

      <Card padded elevated title={t("staff.announcements.history")}>
        {list.error ? (
          <ErrorState
            title={t("common.error")}
            message={errorMessage(list.error, t("common.error"))}
            onRetry={list.reload}
          />
        ) : list.loading && !list.data ? (
          <Skeleton height={120} />
        ) : (list.data?.results.length ?? 0) === 0 ? (
          <EmptyState title={t("staff.empty")} description={t("staff.announcements.noHistory")} />
        ) : (
          <ul className="amk-list">
            {list.data!.results.map((a) => (
              <li key={a.id} className="amk-listitem">
                <div>
                  <strong>{a.subject}</strong>
                  <p className="amk-muted" style={{ whiteSpace: "pre-wrap" }}>
                    {a.body}
                  </p>
                  <span className="amk-muted" style={{ fontSize: 12 }}>
                    {a.author_email} · {formatDateTime(a.sent_at ?? a.created_at, locale)}
                  </span>
                </div>
                {a.sent_at ? (
                  <Badge variant="success">
                    {t("staff.announcements.sentBadge", { count: a.recipient_count })}
                  </Badge>
                ) : (
                  <Badge variant="neutral">{t("staff.announcements.draftBadge")}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmModal
        open={confirmOpen}
        title={t("staff.announcements.send")}
        description={t("staff.announcements.confirmSend", {
          count: count ?? 0,
        })}
        confirmText={t("staff.announcements.confirm")}
        cancelText={t("staff.cancel")}
        onConfirm={() => void onSend()}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  )
}
