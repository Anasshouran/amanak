import { Badge, Button } from "../../design/components"
import { useT } from "../../design/i18n"

export type AnswerFeedbackProps = {
  isCorrect: boolean
  explanation: string
  redFlags?: string[]
  scannerRefs?: string[]
  onNext: () => void
  nextLabel?: string
}

export function AnswerFeedback({
  isCorrect,
  explanation,
  redFlags = [],
  scannerRefs = [],
  onNext,
  nextLabel,
}: AnswerFeedbackProps) {
  const t = useT()
  return (
    <div
      className="amk-card amk-card--padded"
      style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <span
          style={{
            color: isCorrect ? "var(--c-success)" : "var(--c-danger)",
            fontWeight: 700,
            fontSize: "var(--fs-lg)",
          }}
        >
          {isCorrect ? t("awareness.feedback.correct") : t("awareness.feedback.wrong")}
        </span>
        <Badge variant={isCorrect ? "success" : "danger"}>
          {isCorrect ? "✓" : "✗"}
        </Badge>
      </div>
      <div style={{ color: "var(--c-text)" }}>{explanation}</div>
      {redFlags.length > 0 && (
        <div>
          <div style={{ fontSize: "var(--fs-sm)", color: "var(--c-muted)", marginBottom: "var(--space-1)" }}>
            {t("awareness.feedback.red_flags")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)" }}>
            {redFlags.map((f) => (
              <Badge key={f} variant="warning">
                {f}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {scannerRefs.length > 0 && (
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--c-muted)" }}>
          {t("awareness.feedback.rules")}: {scannerRefs.join(", ")}
        </div>
      )}
      <Button variant="primary" onClick={onNext}>
        {nextLabel ?? t("awareness.next")}
      </Button>
    </div>
  )
}
