import type { PasswordEntry } from "@amanak/shared-types"
import { useEffect, useRef, useState } from "react"
import { useT } from "../../design/i18n"
import { Button, Card } from "../../design/components"
import { IconCopy, IconEdit, IconEye, IconEyeOff, IconTrash } from "../../design/icons"
import { RevealTimer } from "./RevealTimer"

export type PasswordEntryRowProps = {
  entry: PasswordEntry
  /** Plaintext, only supplied by the list while this row is revealed. */
  password: string
  revealed: boolean
  onReveal: () => void
  onMask: () => void
  onEdit: () => void
  onDelete: () => void
  /** Resolves the plaintext to copy, decrypting on demand when masked. */
  onCopy: () => Promise<string>
}

function getColorForString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 40%)`
}

function getHostname(url: string | undefined | null): string {
  if (!url) return ""
  try {
    const u = new URL(url)
    return u.hostname
  } catch {
    return url
  }
}

export function PasswordEntryRow({
  entry,
  password,
  revealed,
  onReveal,
  onMask,
  onEdit,
  onDelete,
  onCopy,
}: PasswordEntryRowProps) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<number>(0)
  const displayTitle = entry.title || entry.username || t("common.none")
  const firstChar = displayTitle ? displayTitle[0].toUpperCase() : "?"
  const masked = "••••••••"
  const hostname = getHostname(entry.url)
  const titleId = `vault-entry-${entry.id}-title`

  useEffect(() => {
    if (!copied) return
    window.clearTimeout(copyTimerRef.current)
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 30000)
    return () => window.clearTimeout(copyTimerRef.current)
  }, [copied])

  return (
    <Card className="amk-card--padded amk-card--elevated vault-row" aria-labelledby={titleId}>
      <div className="vault-row__content">
        <div className="vault-row__icon" style={{ backgroundColor: getColorForString(displayTitle) }}>
          <span className="vault-row__icon-letter">{firstChar}</span>
        </div>
        <div className="vault-row__info">
          <h3 className="vault-row__title" id={titleId}>{displayTitle}</h3>
          {entry.username && <p className="vault-row__username" dir="ltr">{entry.username}</p>}
          {hostname && <p className="vault-row__url" dir="ltr">{hostname}</p>}
        </div>
        <div className="vault-row__password">
          <div
            className="vault-row__password-display"
            data-testid={revealed ? "password-revealed" : "password-masked"}
            aria-label={t("vault.password.aria", {
              title: displayTitle,
              state: revealed ? t("vault.state.revealed") : t("vault.state.masked"),
            })}
            dir="ltr"
          >
            {revealed ? password : masked}
          </div>
          {revealed && (
            <div className="vault-row__countdown">
              <RevealTimer active onExpire={onMask} />
            </div>
          )}
        </div>
        <div className="vault-row__actions">
          {revealed ? (
            <Button
              variant="secondary"
              size="sm"
              icon={<IconEyeOff size={14} />}
              onClick={onMask}
              aria-pressed
              aria-label={t("vault.hide_password", { title: displayTitle })}
            >
              {t("vault.hide")}
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon={<IconEye size={14} />}
              onClick={onReveal}
              aria-label={t("vault.reveal_password", { title: displayTitle })}
            >
              {t("vault.reveal")}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            icon={<IconCopy size={14} />}
            onClick={async () => {
              try {
                const value = await onCopy()
                await navigator.clipboard.writeText(value)
                setCopied(true)
              } catch {
                // best effort
              }
            }}
            aria-label={t("vault.copy_password", { title: displayTitle })}
          >
            {copied ? t("vault.copied") : t("vault.copy")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<IconEdit size={14} />}
            onClick={onEdit}
            aria-label={t("actions.edit")}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<IconTrash size={14} />}
            onClick={onDelete}
            aria-label={t("actions.delete")}
          />
        </div>
      </div>
    </Card>
  )
}
