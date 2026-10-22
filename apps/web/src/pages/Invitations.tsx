import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../lib/api"
import { useT } from "../design/i18n"
import type { MyInvitation } from "@amanak/shared-types"
import { useContext_ } from "../state/ContextProvider"

/**
 * P18.3 — "My invitations" list.
 *
 * Every invitation addressed to the signed-in user's email that is still
 * pending and not expired. Accepting creates the membership immediately;
 * declining revokes the invitation on the server.
 */
export function Invitations() {
  const t = useT()
  const nav = useNavigate()
  const { refresh, activate } = useContext_()
  const [items, setItems] = useState<MyInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(() => {
    setLoading(true)
    api
      .listMyInvitations()
      .then((rows) => setItems(Array.isArray(rows) ? rows : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function accept(id: number) {
    setBusyId(id)
    setError("")
    try {
      const result: any = await api.acceptInvitationById(id)
      const joinedId = result?.organization?.id
      if (joinedId) {
        // Pick the new tenant up so /org renders it instead of bouncing to the
        // personal dashboard.
        await refresh()
        activate(String(joinedId))
      }
      nav("/org", { replace: true })
    } catch (e: any) {
      setError(e?.code === "invitation_expired" ? t("org.invitations.accept.expired") : t("org.invitations.accept.invalid"))
    } finally {
      setBusyId(null)
    }
  }

  async function decline(id: number) {
    setBusyId(id)
    setError("")
    try {
      await api.declineInvitationById(id)
      setItems((rows) => rows.filter((r) => r.id !== id))
    } catch {
      setError(t("common.error"))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="amk-page">
      <h1 style={{ margin: "0 0 16px" }}>{t("org.invitations.title")}</h1>

      {error && (
        <div className="amk-card amk-card--padded" role="alert" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="amk-card amk-card--padded">{t("common.loading")}</div>
      ) : items.length === 0 ? (
        <div className="amk-card amk-card--padded">{t("org.invitations.empty")}</div>
      ) : (
        <div className="amk-card amk-card--padded">
          {items.map((inv) => (
            <div
              key={inv.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 0",
                borderBottom: "1px solid var(--c-border)",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{inv.organization.name}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {t("org.invitations.accept.invited_as")}{" "}
                  {t(`org.invite.role.${inv.role}`) || inv.role}
                  {inv.invited_by_email ? ` · ${inv.invited_by_email}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => accept(inv.id)} disabled={busyId === inv.id}>
                  {t("org.invitations.accept.accept")}
                </button>
                <button onClick={() => decline(inv.id)} disabled={busyId === inv.id}>
                  {t("org.invitations.accept.decline")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Invitations
