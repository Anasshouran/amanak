import type { TwoFactorEntry } from "@amanak/shared-types"
import { useT } from "../../design/i18n"
import { Button, Badge } from "../../design/components"
import { TotpDisplay } from "./TotpDisplay"
import { IconEdit, IconTrash } from "../../design/icons"

export type TwoFactorRowProps = {
  entry: TwoFactorEntry
  now: number
  onEdit: () => void
  onDelete: () => void
  onCopy: (code: string) => void
}

export function TwoFactorRow({ entry, now, onEdit, onDelete, onCopy }: TwoFactorRowProps) {
  const t = useT()
  const title = entry.issuer ? `${entry.issuer} · ${entry.label}` : entry.label

  // We need to generate a color for the icon background based on the issuer or label to have consistent colors.
  // We'll use a simple hash function to convert the string to a color.
  const getColorForString = (str: string) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    // Convert hash to a hue
    const hue = hash % 360
    return `hsl(${hue}, 70%, 40%)` // a nice color
  }

  const displayText = entry.issuer ?? entry.label
  const firstChar = displayText ? displayText[0].toUpperCase() : '?'

  return (
    <div className="amk-card amk-card--padded amk-card--elevated vault-2fa-row">
      <div className="vault-2fa-row__content">
        <div className="vault-2fa-row__icon" style={{ backgroundColor: getColorForString(displayText) }}>
          <span className="vault-2fa-row__icon-letter">{firstChar}</span>
        </div>
        <div className="vault-2fa-row__info">
          <p className="vault-2fa-row__issuer">{entry.issuer ?? t("common.none")}</p>
          <p className="vault-2fa-row__label">{entry.label}</p>
        </div>
        <div className="vault-2fa-row__totp">
          <TotpDisplay
            entry={entry}
            now={now}
            onCopy={onCopy}
          />
        </div>
        <div className="vault-2fa-row__actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={onEdit}
            aria-label={t("actions.edit")}
          >
            <IconEdit size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            aria-label={t("actions.delete")}
          >
            <IconTrash size={14} />
          </Button>
        </div>
      </div>
    </div>
  )
}
