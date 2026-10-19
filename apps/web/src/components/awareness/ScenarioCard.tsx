import { Badge } from "../../design/components"
import { useT } from "../../design/i18n"

export type ScenarioCardProps = {
  category: string
  difficulty: number
  title: string
}

const DIFFICULTY_LABELS = ["", "●", "●●", "●●●"]

export function ScenarioCard({ category, difficulty, title }: ScenarioCardProps) {
  const t = useT()
  const catKey = `awareness.category.${category}` as const
  const catLabel = t(catKey as string) || category
  return (
    <div
      className="amk-card amk-card--padded amk-awareness-scenario"
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Badge variant="info">{catLabel}</Badge>
        <span
          style={{ color: "var(--c-muted)", fontSize: "var(--fs-sm)", letterSpacing: 2 }}
          aria-label={`difficulty ${difficulty}`}
        >
          {DIFFICULTY_LABELS[Math.min(3, Math.max(0, difficulty))] || "●"}
        </span>
      </div>
      <h2 style={{ margin: 0, color: "var(--c-text)", fontSize: "var(--fs-lg)" }}>{title}</h2>
    </div>
  )
}
