import { Button, ProgressRing } from "../../design/components"
import { useT } from "../../design/i18n"

export type SessionSummaryProps = {
  score: number
  total: number
  newBadges?: string[]
  onTryAgain: () => void
  onBack: () => void
}

export function SessionSummary({ score, total, newBadges = [], onTryAgain, onBack }: SessionSummaryProps) {
  const t = useT()
  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  return (
    <div
      className="amk-card amk-card--padded"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)" }}
    >
      <ProgressRing value={pct} size={140} label={`${score}/${total}`} caption={t("awareness.summary.score")} />
      {newBadges.length > 0 && (
        <div style={{ width: "100%" }}>
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--c-muted)", marginBottom: "var(--space-2)" }}>
            {t("awareness.summary.new_badges")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
            {newBadges.map((b) => (
              <span key={b} style={{ color: "var(--c-success)", fontWeight: 600 }}>
                {b}
              </span>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <Button variant="primary" onClick={onTryAgain}>
          {t("awareness.summary.try_again")}
        </Button>
        <Button variant="secondary" onClick={onBack}>
          {t("awareness.summary.back")}
        </Button>
      </div>
    </div>
  )
}
