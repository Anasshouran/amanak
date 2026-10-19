import { useT } from "../../design/i18n"

export type BadgeItem = {
  id: string
  title: string
  description?: string
  earned: boolean
}

export type BadgeGridProps = {
  badges: BadgeItem[]
}

export function BadgeGrid({ badges }: BadgeGridProps) {
  const t = useT()
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "var(--space-3)" }}>
      {badges.map((b) => (
        <div
          key={b.id}
          title={b.description}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-1)",
            padding: "var(--space-3)",
            borderRadius: "var(--c-radius-md)",
            background: b.earned ? "var(--c-surface)" : "var(--c-bg)",
            opacity: b.earned ? 1 : 0.5,
            border: "1px solid var(--c-border)",
          }}
        >
          <span style={{ fontSize: 24 }}>{b.earned ? "🏅" : "🔒"}</span>
          <span style={{ fontSize: "var(--fs-sm)", color: "var(--c-text)", textAlign: "center" }}>{b.title}</span>
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--c-muted)" }}>
            {b.earned ? t("awareness.badges.earned") : t("awareness.badges.locked")}
          </span>
        </div>
      ))}
    </div>
  )
}
