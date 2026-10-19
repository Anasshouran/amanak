import { useT } from "../../design/i18n"

export type ScenarioPromptProps = {
  category: string
  prompt: string
}

export function ScenarioPrompt({ category, prompt }: ScenarioPromptProps) {
  const t = useT()
  if (category === "url") {
    return (
      <div
        className="amk-card amk-card--padded"
        style={{ background: "var(--c-surface)", borderRadius: "var(--c-radius-lg)" }}
      >
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--c-muted)", marginBottom: "var(--space-2)" }}>
          {t("awareness.scenario.url_label" as string) || "URL"}
        </div>
        <div
          dir="ltr"
          style={{
            fontFamily: "monospace",
            wordBreak: "break-all",
            color: "var(--c-text)",
            fontSize: "var(--fs-md)",
          }}
        >
          {prompt}
        </div>
      </div>
    )
  }
  if (category === "sms") {
    return (
      <div
        className="amk-card amk-card--padded"
        style={{
          background: "var(--c-surface)",
          borderRadius: "var(--c-radius-lg)",
          maxWidth: 360,
          margin: "0 auto",
        }}
      >
        <div style={{ fontSize: "var(--fs-xs)", color: "var(--c-muted)", marginBottom: "var(--space-2)" }}>
          {t("awareness.scenario.sms_label" as string) || "SMS"}
        </div>
        <div style={{ color: "var(--c-text)", whiteSpace: "pre-wrap" }}>{prompt}</div>
      </div>
    )
  }
  // email (default) and qr
  return (
    <div
      className="amk-card amk-card--padded"
      style={{ background: "var(--c-surface)", borderRadius: "var(--c-radius-lg)" }}
    >
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--c-muted)", marginBottom: "var(--space-2)" }}>
        {category === "qr"
          ? t("awareness.scenario.qr_label" as string) || "QR"
          : t("awareness.scenario.email_label" as string) || "Email"}
      </div>
      <div style={{ color: "var(--c-text)", whiteSpace: "pre-wrap" }}>{prompt}</div>
    </div>
  )
}
