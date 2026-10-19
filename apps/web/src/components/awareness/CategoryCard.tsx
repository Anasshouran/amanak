import type { AwarenessCategory } from "@amanak/shared-types"
import { Button, Card, Badge } from "../../design/components"
import { useT } from "../../design/i18n"

export type CategoryCardProps = {
  id: string
  title: string
  attempted: number
  total: number
  onStart: (id: string) => void
}

export function CategoryCard({ id, title, attempted, total, onStart }: CategoryCardProps) {
  const t = useT()
  const pct = total > 0 ? Math.round((attempted / total) * 100) : 0
  return (
    <Card padded elevated className="amk-awareness-category">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, color: "var(--c-text)", fontSize: "var(--fs-md)" }}>{title}</h3>
          <Badge variant="info">{attempted}/{total}</Badge>
        </div>
        <div
          style={{
            height: 6,
            background: "var(--c-border)",
            borderRadius: "var(--c-radius-sm)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "var(--c-brand)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <Button variant="primary" size="sm" onClick={() => onStart(id)}>
          {t("awareness.start")}
        </Button>
      </div>
    </Card>
  )
}

