import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { TwoFactorProfile } from "@amanak/shared-types"

import { aadFromEntryId, decrypt } from "../crypto/aes"
import { deriveKey, generateSalt } from "../crypto/kdf"
import { isUnlocked, lock as dropKey, unlock as keepKey } from "../crypto/unlock"
import { Button, Card, ErrorState, Input, Skeleton } from "../design/components"
import { useT } from "../design/i18n"
import { IconKey, IconLock } from "../design/icons"
import { api } from "../lib/api"
import { errorCode, errorMessage, useAsync } from "../lib/useAsync"
import { TwoFactorList } from "../components/vault/TwoFactorList"

function bytesToB64(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function TwoFactor() {
  const t = useT()
  const [unlocked, setUnlocked] = useState(isUnlocked())
  const [autoLockNotice, setAutoLockNotice] = useState(false)

  const profile = useAsync<TwoFactorProfile | null>(async () => {
    try {
      return await api.getTwoFactorProfile()
    } catch (err) {
      if (errorCode(err) === "not_found") return null
      throw err
    }
  }, [])

  if (profile.loading) {
    return (
      <div className="amk-page">
        <Skeleton height={28} width="45%" />
        <Skeleton height={16} width="70%" />
        <Skeleton height={120} />
        <Skeleton height={120} />
      </div>
    )
  }

  if (profile.error) {
    return (
      <div className="amk-page">
        <ErrorState
          title={t("common.error")}
          message={errorMessage(profile.error, t("common.error"))}
          onRetry={profile.reload}
          retryLabel={t("actions.retry")}
        />
      </div>
    )
  }

  if (!profile.data) {
    return (
      <div className="amk-page">
        <PageHead icon={<IconKey size={20} />} />
        <SetupScreen
          onCreated={() => {
            setUnlocked(true)
            profile.reload()
          }}
        />
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="amk-page">
        <PageHead icon={<IconKey size={20} />} />
        <UnlockScreen
          profile={profile.data}
          autoLockNotice={autoLockNotice}
          onUnlocked={() => {
            setUnlocked(true)
            setAutoLockNotice(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="amk-page">
      <PageHead icon={<IconKey size={20} />}>
        <Button
          variant="secondary"
          icon={<IconLock size={16} />}
          onClick={() => {
            dropKey()
            setUnlocked(false)
            setAutoLockNotice(false)
          }}
        >
          {t("2fa.lock")}
        </Button>
      </PageHead>
      <TwoFactorList
        profile={profile.data}
        onAutoLocked={() => {
          dropKey()
          setUnlocked(false)
          setAutoLockNotice(true)
        }}
        onVaultDeleted={() => {
          dropKey()
          setUnlocked(false)
          profile.reload()
        }}
      />
    </div>
  )
}

function PageHead({ icon, children }: { icon?: ReactNode; children?: ReactNode }) {
  const t = useT()
  return (
    <div className="amk-page-head">
      <div>
        <h1>
          {icon} {t("2fa.title")}
        </h1>
        <p>{t("2fa.subtitle")}</p>
      </div>
      {children}
    </div>
  )
}

function SetupScreen({ onCreated }: { onCreated: () => void }) {
  const t = useT()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strong = useMemo(
    () =>
      password.length >= 12 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password),
    [password],
  )

  async function submit() {
    if (password.length < 12) {
      setError(t("2fa.setup.err.weak"))
      return
    }
    if (password !== confirm) {
      setError(t("2fa.setup.err.mismatch"))
      return
    }
    if (!crypto.subtle) {
      setError(t("2fa.setup.err.crypto"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const salt = generateSalt()
      const profile = await api.createTwoFactorProfile({ kdf_salt: bytesToB64(salt) })
      const key = await deriveKey(password, salt, profile.kdf_iterations)
      keepKey(key)
      onCreated()
    } catch (err) {
      setError(errorMessage(err, t("2fa.setup.err.create")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card padded elevated title={t("2fa.setup.title")}>
      <p className="amk-muted">{t("2fa.setup.description")}</p>
      <form
        className="amk-stack"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <Input
          label={t("2fa.setup.master")}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={
            strong ? t("2fa.setup.strong") : `${t("2fa.setup.min")} · ${t("2fa.setup.weak")}`
          }
        />
        <Input
          label={t("2fa.setup.confirm")}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <p className="amk-note" role="note">
          {t("2fa.setup.warning")}
        </p>
        {error && (
          <p className="amk-field-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy} icon={<IconKey size={16} />}>
          {t("2fa.setup.create")}
        </Button>
      </form>
    </Card>
  )
}

function UnlockScreen({
  profile,
  autoLockNotice,
  onUnlocked,
}: {
  profile: TwoFactorProfile
  autoLockNotice: boolean
  onUnlocked: () => void
}) {
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
      setError(t("2fa.setup.err.crypto"))
      return
    }
    if (locked) return
    setBusy(true)
    setError(null)
    try {
      const salt = b64ToBytes(profile.kdf_salt)
      const key = await deriveKey(password, salt, profile.kdf_iterations)
      const entries = await api.listTwoFactorEntries()
      if (entries.length > 0) {
        await decrypt(key, b64ToBytes(entries[0].ciphertext), b64ToBytes(entries[0].iv), aadFromEntryId(entries[0].id))
      }
      keepKey(key)
      attemptsRef.current = 0
      firstFailRef.current = null
      onUnlocked()
    } catch {
      // Wrong password (or an unreadable entry) counts as a failed attempt.
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
        setError(t("2fa.unlock.err.wrong", { attempts: attemptsRef.current }))
      }
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (password) setError(null)
  }, [password])

  return (
    <Card padded elevated title={t("2fa.unlock.title")}>
      <p className="amk-muted">{t("2fa.unlock.description")}</p>
      {autoLockNotice && (
        <p className="amk-note" role="status">
          {t("2fa.autoLocked")}
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
          label={t("2fa.unlock.label")}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error ?? undefined}
        />
        {locked && (
          <p className="amk-field-error" role="alert">
            {t("2fa.unlock.err.locked", { minutes: Math.max(1, Math.ceil(lockedFor / 60_000)) })}
          </p>
        )}
        <Button type="submit" loading={busy} icon={<IconKey size={16} />}>
          {busy ? t("2fa.unlock.working") : t("2fa.unlock.action")}
        </Button>
      </form>
    </Card>
  )
}
