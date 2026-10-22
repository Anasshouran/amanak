import { useState } from "react"
import { useT } from "../../design/i18n"
import { api } from "../../lib/api"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function InviteModal({
  open,
  onClose,
  orgId,
  orgName,
  isOwner,
  onSent,
}: {
  open: boolean
  onClose: () => void
  orgId: string
  orgName: string
  isOwner: boolean
  /** Called after the invitation was created, so callers can refresh. */
  onSent?: () => void
}) {
  const t = useT()
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState("")
  const [role, setRole] = useState("employee")
  const [err, setErr] = useState("")
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!open) return null

  async function submit() {
    setEmailError("")
    if (!EMAIL_RE.test(email)) {
      setEmailError(t("org.invite.invalid_email"))
      return
    }
    setBusy(true)
    setErr("")
    try {
      await api.post(`/organizations/${orgId}/members/invite/`, { email, role })
      setOk(true)
      onSent?.()
      setTimeout(() => {
        setOk(false)
        setEmail("")
        setRole("employee")
        setEmailError("")
        onClose()
      }, 800)
    } catch (e: any) {
      setErr(e?.response?.data?.message || t("common.error"))
    } finally {
      setBusy(false)
    }
  }

  const roles = ["employee", "analyst", "auditor", ...(isOwner ? ["admin"] : [])]

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div className="amk-card amk-card--padded" style={{ width: 420, maxWidth: "90vw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>{t("org.invite.title") || `Invite to ${orgName}`}</h2>
          <button onClick={onClose} aria-label="close">
            ×
          </button>
        </div>
        {ok ? (
          <p role="status">{t("org.invite.success") || "Invite sent"}</p>
        ) : (
          <>
            <label htmlFor="invite-email">{t("org.invite.email") || "Email"}</label>
            <input
              id="invite-email"
              aria-label={t("org.invite.email") || "Email"}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (emailError) setEmailError("")
              }}
              style={{ width: "100%" }}
            />
            {emailError && (
              <p className="invite-error" role="alert" style={{ color: "var(--c-danger)", margin: "4px 0 0" }}>
                {emailError}
              </p>
            )}
            <label htmlFor="invite-role" style={{ display: "block", marginTop: 8 }}>
              {t("org.invite.role") || "Role"}
            </label>
            <select
              id="invite-role"
              aria-label={t("org.invite.role") || "Role"}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ width: "100%" }}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {t(`org.invite.role.${r}`) || r}
                </option>
              ))}
            </select>
            {err && (
              <div role="alert" style={{ color: "var(--c-danger)" }}>
                {err}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={onClose}>{t("common.cancel") || "Cancel"}</button>
              <button onClick={submit} disabled={busy}>
                {t("org.invite.submit") || "Send invite"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
