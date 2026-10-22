import { useEffect, useState } from "react"
import { useT } from "../../design/i18n"
import { api } from "../../lib/api"

type PendingInvitation = {
  id: number
  email: string
  role: string
  status: string
  created_at: string
  expires_at: string
}

/**
 * Pending invitations for an organization (P18.3).
 *
 * Visible to owners/admins only (``canManage``). Each pending invitation
 * can be revoked, which asks for confirmation first — revoking is
 * irreversible from the UI.
 */
export function PendingInvitations({
  orgId,
  canManage,
  nonce = 0,
}: {
  orgId: string
  canManage: boolean
  /** Bumped by the parent after an invite to force a refresh. */
  nonce?: number
}) {
  const t = useT()
  const [items, setItems] = useState<PendingInvitation[]>([])
  const [confirming, setConfirming] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!canManage) return
    let alive = true
    api
      .get<PendingInvitation[]>(`/organizations/${orgId}/invitations/`)
      .then((rows) => {
        if (alive) setItems(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (alive) setItems([])
      })
    return () => {
      alive = false
    }
  }, [orgId, canManage, nonce])

  async function revoke(id: number) {
    setBusy(true)
    setError("")
    try {
      await api.delete(`/organizations/${orgId}/invitations/${id}/`)
      setConfirming(null)
      setItems((rows) => rows.filter((r) => r.id !== id))
    } catch (e: any) {
      setError(e?.response?.data?.message || t("common.error"))
    } finally {
      setBusy(false)
    }
  }

  if (!canManage) return null
  if (items.length === 0) return null

  return (
    <section className="amk-org-section">
      <div className="amk-org-section__header">
        <h2 className="amk-org-section__title">{t("org.members.pending")}</h2>
      </div>
      {error && <div className="amk-org-table__empty">{error}</div>}
      <div className="amk-org-table">
        {items.map((it) => (
          <div className="amk-org-table__row" key={it.id}>
            <div className="amk-org-table__main">
              <div className="amk-org-table__title">{it.email}</div>
              <div className="amk-org-table__meta">
                {t(`org.invite.role.${it.role}`) || it.role}
              </div>
            </div>
            <div className="amk-org-table__time">
              {it.expires_at
                ? new Date(it.expires_at).toLocaleDateString()
                : "—"}
            </div>
            <div className="amk-org-table__actions">
              {confirming === it.id ? (
                <>
                  <button onClick={() => revoke(it.id)} disabled={busy}>
                    {t("org.invitations.revoke_confirm")}
                  </button>
                  <button onClick={() => setConfirming(null)} disabled={busy}>
                    {t("common.cancel")}
                  </button>
                </>
              ) : (
                <button onClick={() => setConfirming(it.id)} disabled={busy}>
                  {t("org.invitations.revoke")}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
