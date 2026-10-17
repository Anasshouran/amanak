import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { PasswordVaultProfile } from "@amanak/shared-types"
import { useT } from "../../design/i18n"
import { Button, Card, Input } from "../../design/components"
import { IconKey, IconLock } from "../../design/icons"

export type VaultLockScreenProps = {
  profile: PasswordVaultProfile
  autoLockNotice?: boolean
  onUnlocked: () => void
  icon?: ReactNode
  errorMessage?: (err: unknown) => string
  verify: (password: string, profile: PasswordVaultProfile) => Promise<void>
}

export function VaultLockScreen({
  profile,
  autoLockNotice = false,
  onUnlocked,
  icon = <IconKey size={20} />,
  errorMessage = (err: unknown) => String(err),
  verify,
}: VaultLockScreenProps) {
  const t = useT()
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const attemptsRef = useRef(0)
  const firstFailRef = useRef<number | null>(null)
  const lockedUntilRef = useRef(0)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const lockedFor = Math.max(0, lockedUntilRef.current - now)
  const locked = lockedFor > 0

  async function attempt() {
    if (!crypto.subtle) {
      setError(t("passwords.setup.err.crypto"))
      return
    }
    if (locked) return
    setBusy(true)
    setError(null)
    try {
      await verify(password, profile)
      attemptsRef.current = 0
      firstFailRef.current = null
      onUnlocked()
    } catch (err) {
      const failedAt = Date.now()
      if (firstFailRef.current === null || failedAt - firstFailRef.current > 5 * 60_000) {
        attemptsRef.current = 1
        firstFailRef.current = failedAt
      } else {
        attemptsRef.current += 1
      }
      if (attemptsRef.current >= 5) {
        lockedUntilRef.current = Date.now() + 15 * 60_000
        attemptsRef.current = 0
        firstFailRef.current = null
        setError("")
      } else {
        setError(t("passwords.unlock.err.wrong", { attempts: attemptsRef.current }))
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (password) setError(null)
  }, [password])

  return (
    <Card padded elevated title={t("vault.locked.title")}>
      <p className="amk-muted">{t("passwords.unlock.description")}</p>
      {autoLockNotice && (
        <p className="amk-note" role="status">
          {t("passwords.autoLocked")}
        </p>
      )}
      <form
        className="amk-stack"
        onSubmit={(event) => {
          event.preventDefault()
          void attempt()
        }}
      >
        <Input
          id="vault-master-password"
          label={t("passwords.unlock.label")}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error ?? undefined}
        />
        {locked && (
          <p className="amk-field-error" role="alert">
            {t("passwords.unlock.err.locked", { minutes: Math.max(1, Math.ceil(lockedFor / 60_000)) })}
          </p>
        )}
        <Button type="submit" loading={busy} icon={<IconKey size={16} />}>
          {busy ? t("passwords.unlock.working") : t("vault.unlock")}
        </Button>
        <button
          type="button"
          className="vault-link"
          onClick={() => {
            // Existing behavior is a warning modal in page; keep no-op shell
          }}
          aria-label={t("vault.forgot_password")}
        >
          {t("vault.forgot_password")}
        </button>
      </form>
    </Card>
  )
}
