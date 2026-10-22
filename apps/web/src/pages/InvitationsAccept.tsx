import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { api } from "../lib/api"
import { useAuth } from "../state/AuthContext"
import { useT } from "../design/i18n"
import { useContext_ } from "../state/ContextProvider"

type Status = "idle" | "loading" | "ok" | "err"

/**
 * P18.3 — invite landing page: `/invitations/accept?token=…`.
 *
 * The page never accepts the invitation on its own: joining an organization
 * must be an explicit action, otherwise an email client prefetching the link
 * would silently add the user to a tenant. "Accept" posts the token;
 * "Decline" sends the user to the invitation list, where the invitation can
 * be declined by id (the token endpoint only accepts).
 */
export function InvitationsAccept() {
  const t = useT()
  const [sp] = useSearchParams()
  const token = sp.get("token") || ""
  const nav = useNavigate()
  const { user, loading } = useAuth()
  const { refresh, activate } = useContext_()
  const [status, setStatus] = useState<Status>("idle")
  const [message, setMessage] = useState("")

  useEffect(() => {
    if (loading) return
    if (!user) {
      const returnTo = `/invitations/accept?token=${encodeURIComponent(token)}`
      nav(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true })
      return
    }
    if (!token) {
      setStatus("err")
      setMessage(t("org.invitations.accept.invalid"))
    }
  }, [loading, user, token, nav, t])

  async function accept() {
    setStatus("loading")
    setMessage("")
    try {
      const result: any = await api.post("/organizations/invitations/accept/", { token })
      const joinedId = result?.organization?.id
      if (joinedId) {
        await refresh()
        activate(String(joinedId))
      }
      setStatus("ok")
      setMessage(t("org.invitations.accept.accepted"))
    } catch (e: any) {
      const code = e?.response?.data?.code ?? e?.code
      setStatus("err")
      setMessage(
        code === "invitation_expired" || code === "invitation_used"
          ? t("org.invitations.accept.expired")
          : t("org.invitations.accept.invalid"),
      )
    }
  }

  return (
    <div className="amk-page">
      <div className="amk-card amk-card--padded" style={{ maxWidth: 460, margin: "40px auto" }}>
        <h1 style={{ marginTop: 0 }}>{t("org.invitations.accept.title")}</h1>

        {status === "idle" && (
          <>
            <p>{t("org.invitations.accept.invited_as")}…</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={accept} disabled={!token}>
                {t("org.invitations.accept.accept")}
              </button>
              <button onClick={() => nav("/invitations")}>
                {t("org.invitations.accept.decline")}
              </button>
            </div>
          </>
        )}

        {status === "loading" && <p>{t("common.loading")}</p>}

        {status === "ok" && (
          <>
            <p role="status">{message}</p>
            <button onClick={() => nav("/org", { replace: true })}>
              {t("org.dashboard.title")}
            </button>
          </>
        )}

        {status === "err" && (
          <>
            <p role="alert">{message}</p>
            <button onClick={() => nav("/dashboard")}>{t("common.menu")}</button>
          </>
        )}
      </div>
    </div>
  )
}

export default InvitationsAccept
