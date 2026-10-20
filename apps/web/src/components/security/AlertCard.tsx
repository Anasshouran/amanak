import { Button, Badge } from "../../design/components"
import { useT } from "../../design/i18n"
import { useTheme } from "../../design/ThemeProvider"
import { deviceTypeFromLabel, formatDevice } from "../../lib/deviceName"
import { DeviceIcon } from "./DeviceIcon"

export type AlertCardProps = {
  id: number
  reasons: string[]
  createdAt: string
  device: string
  ip: string | null
  onMarkRead: (id: number) => void
  onNotMe: () => void
}

export function AlertCard({ id, reasons, createdAt, device, ip, onMarkRead, onNotMe }: AlertCardProps) {
  const t = useT()
  const { locale: themeLocale } = useTheme()
  const locale = (themeLocale === "ar" ? "ar" : "en") as "ar" | "en"
  const type = deviceTypeFromLabel(device)
  return (
    <div
      className="amk-card amk-card--padded"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        border: "1px solid var(--c-danger)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <span style={{ color: "var(--c-danger)", fontSize: "var(--fs-lg)" }}>●</span>
        <strong style={{ color: "var(--c-text)" }}>
          {reasons.includes("new_device")
            ? t("security.alerts.reason.new_device")
            : reasons.includes("multiple_failed_attempts")
            ? t("security.alerts.reason.multiple_failed_attempts")
            : reasons.join(", ")}
        </strong>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--c-muted)", fontSize: "var(--fs-sm)" }}>
        <DeviceIcon type={type} size={16} />
        <span>{formatDevice(device, locale)}</span>
        <span>·</span>
        <span>{ip || "—"}</span>
      </div>
      <div style={{ color: "var(--c-muted)", fontSize: "var(--fs-xs)" }}>
        {new Date(createdAt).toLocaleString()}
      </div>
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <Button variant="secondary" size="sm" onClick={() => onMarkRead(id)}>
          {t("security.alerts.mark_read")}
        </Button>
        <Button variant="danger" size="sm" onClick={onNotMe}>
          {t("security.alerts.wasnt_me")}
        </Button>
      </div>
    </div>
  )
}
