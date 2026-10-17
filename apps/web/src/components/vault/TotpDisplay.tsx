import type { TwoFactorEntry } from "@amanak/shared-types"
import { useEffect, useState } from "react"
import { useT } from "../../design/i18n"
import { withKey } from "../../crypto/unlock"
import { aadFromEntryId, decrypt } from "../../crypto/aes"
import { generateTotp } from "../../crypto/totp"
import { Button } from "../../design/components"
import { IconCopy } from "../../design/icons"

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const TOTP_STEP_MS = 30_000

export type TotpDisplayProps = {
  entry: TwoFactorEntry
  now: number
  onCopy: (code: string) => void
  className?: string
}

export function TotpDisplay({ entry, now, onCopy, className }: TotpDisplayProps) {
  const t = useT()
  const [code, setCode] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  const step = Math.floor(now / 1000 / 30)
  const secondsRemaining = Math.floor((TOTP_STEP_MS - (now % TOTP_STEP_MS)) / 1000)

  // Generate the TOTP code whenever the entry or step changes
  useEffect(() => {
    let cancelled = false
    const generateCode = async () => {
      try {
        const result = await withKey(async (key) => {
          const ciphertextBytes = b64ToBytes(entry.ciphertext)
          const ivBytes = b64ToBytes(entry.iv)
          const aad = aadFromEntryId(entry.id)
          const decrypted = await decrypt(key, ciphertextBytes, ivBytes, aad)
          return generateTotp(decrypted, step * 30_000)
        })
        if (!cancelled) {
          if (result) {
            setCode(result)
            setFailed(false)
          } else {
            setFailed(true)
          }
        }
      } catch (err) {
        if (!cancelled) {
          setFailed(true)
        }
      }
    }

    generateCode()
    return () => {
      cancelled = true
    }
  }, [entry.id, entry.ciphertext, entry.iv, step])

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(id)
  }, [copied])

  async function handleCopy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      // clipboard unavailable (e.g. insecure context)
    }
  }

  return (
    <div className={`totp-display ${className ?? ""}`}>
      <div className="totp-display__code">
        {failed && !code ? (
          <div className="amk-skeleton" style={{ width: 110, height: 28 }} />
        ) : (
          <strong className="vault-2fa-code" aria-live="polite" dir="ltr" data-testid="totp-code">
            {code ?? "·····"}
          </strong>
        )}
      </div>
      <div className="totp-display__countdown">
        <div className="totp-display__progress">
          <div
            className={`totp-display__progress-bar${secondsRemaining <= 5 ? " is-warning" : ""}`}
            style={{ width: `${Math.round((secondsRemaining / 30) * 100)}%` }}
          />
        </div>
        <div className="totp-display__countdown-text">
          {t("twofa.expires_in", { seconds: secondsRemaining })}
        </div>
      </div>
      <div className="totp-display__actions">
        <Button
          variant="secondary"
          size="sm"
          icon={<IconCopy size={14} />}
          onClick={handleCopy}
          aria-label={t("twofa.copy.aria", { issuer: entry.issuer ?? entry.label })}
        >
          {copied ? t("twofa.copied") : t("twofa.copy")}
        </Button>
      </div>
    </div>
  )
}
