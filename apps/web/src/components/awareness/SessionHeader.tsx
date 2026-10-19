import { Button } from "../../design/components"
import { useT } from "../../design/i18n"

export type SessionHeaderProps = {
  current: number
  total: number
  onExit: () => void
}

export function SessionHeader({ current, total, onExit }: SessionHeaderProps) {
  const t = useT()
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--c-muted)", fontSize: "var(--fs-sm)" }}>
          {t("awareness.session.progress")}: {current}/{total}
        </span>
        <Button variant="ghost" size="sm" onClick={onExit}>
          {t("awareness.session.exit")}
        </Button>
      </div>
      <div
        style={{
          height: 4,
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
    </div>
  )
}
