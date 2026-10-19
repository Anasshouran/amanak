import { Button } from "../../design/components"
import { useT } from "../../design/i18n"

export type AnswerButtonsProps = {
  disabled?: boolean
  onAnswer: (a: "safe" | "phishing" | "unsure") => void
}

export function AnswerButtons({ disabled, onAnswer }: AnswerButtonsProps) {
  const t = useT()
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <Button
        variant="secondary"
        fullWidth
        disabled={disabled}
        onClick={() => onAnswer("safe")}
      >
        {t("awareness.answer.safe")}
      </Button>
      <Button
        variant="danger"
        fullWidth
        disabled={disabled}
        onClick={() => onAnswer("phishing")}
      >
        {t("awareness.answer.phishing")}
      </Button>
      <Button
        variant="ghost"
        fullWidth
        disabled={disabled}
        onClick={() => onAnswer("unsure")}
      >
        {t("awareness.answer.unsure")}
      </Button>
    </div>
  )
}
