import { useEffect, useState } from "react"
import { useT } from "../../design/i18n"
import { api } from "../../lib/api"

type Inv = {
  id: number
  organization: { id: string; name: string; slug: string }
  role: string
  invited_by_email: string
  created_at: string
  expires_at: string
}

export function InvitationsBanner() {
  const t = useT()
  const [items, setItems] = useState<Inv[]>([])

  useEffect(() => {
    let alive = true
    api
      .get<Inv[]>("/me/invitations/")
      .then((d) => {
        if (alive) setItems(Array.isArray(d) ? d : [])
      })
      .catch(() => {
        if (alive) setItems([])
      })
    return () => {
      alive = false
    }
  }, [])

  if (items.length === 0) return null

  return (
    <div className="amk-card amk-card--padded" style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        {t("org.invitations.pending_banner") || "You have pending invitations"}{" "}
        ({items.length})
      </div>
      {items.map((i) => (
        <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>
            {i.organization.name} · {t(`org.invite.role.${i.role}`) || i.role}
          </span>
          <a href="/invitations">{t("org.invitations.review") || "Review"} →</a>
        </div>
      ))}
    </div>
  )
}
