import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { TwoFactorProfile } from "@amanak/shared-types"

import { aadFromEntryId, decrypt } from "../crypto/aes"
import { toBytes } from "../crypto/bytes"
import { generateRecoveryCodes, unwrapKeyWithRecovery } from "../crypto/recovery"
import { PBKDF2_ITERATIONS, deriveKey, generateSalt } from "../crypto/kdf"
import { isUnlocked, lock as dropKey, unlock as keepKey } from "../crypto/unlock"
import { createVerification } from "../crypto/verification"
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
          onRecovered={() => {
            // The recovery flow rotated kdf_salt; refetch the profile so the
            // next unlock derives K from the NEW salt.
            void profile.reload()
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

      <RecoveryCodesCard profile={profile.data} />
    </div>
  )
}

function RecoveryCodesCard({ profile }: { profile: TwoFactorProfile }) {
  const t = useT()
  const [count, setCount] = useState<{ total: number; used: number; remaining: number } | null>(null)
  const [showRegen, setShowRegen] = useState(false)
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [ack, setAck] = useState(false)

  useEffect(() => {
    void api.getRecoveryCodeCount().then(setCount).catch(() => setCount(null))
  }, [])

  async function regenerate() {
    if (password.length < 12) {
      setError(t("passwords.setup.err.weak"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const salt = b64ToBytes(profile.kdf_salt)
      // extractable=true so wrapKey can bundle it into recovery codes
      const key = await deriveKey(password, salt, profile.kdf_iterations, true)
      // verify key works
      const entries = await api.listTwoFactorEntries()
      if (entries.length > 0) {
        await decrypt(key, b64ToBytes(entries[0].ciphertext), b64ToBytes(entries[0].iv), aadFromEntryId(entries[0].id))
      }
      const gen = await generateRecoveryCodes(key, 10)
      const stored = gen.stored.map((c) => ({
        code_hash: c.code_hash,
        salt: bytesToB64(c.salt),
        ciphertext: bytesToB64(c.ciphertext),
        iv: bytesToB64(c.iv),
      }))
      await api.deleteRecoveryCodes()
      await api.createRecoveryCodes(stored)
      setCodes(gen.codes)
      setShowRegen(false)
      setPassword("")
      const c = await api.getRecoveryCodeCount()
      setCount(c)
    } catch (err) {
      setError(errorMessage(err, t("passwords.setup.err.create")))
    } finally {
      setBusy(false)
    }
  }

  if (codes) {
    return (
      <Card padded elevated title={t("twofa.recovery.setup.title")}>
        <p className="amk-muted">{t("twofa.recovery.setup.subtitle")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-2)" }}>
          {codes.map((c, i) => (
            <code key={i} style={{ padding: "var(--space-2)", background: "var(--c-bg)", borderRadius: "var(--c-radius-sm)", fontFamily: "monospace", fontSize: "var(--fs-sm)" }}>
              {c}
            </code>
          ))}
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <Button variant="secondary" size="sm" onClick={() => { const blob = new Blob([codes.join("\n")], { type: "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "amanak-recovery-codes.txt"; a.click(); URL.revokeObjectURL(url) }}>
            {t("twofa.recovery.setup.download")}
          </Button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--c-text)" }}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>{t("twofa.recovery.setup.acknowledge")}</span>
        </label>
        <Button onClick={() => { if (ack) { setCodes(null); setAck(false) } }} disabled={!ack}>
          {t("twofa.recovery.setup.continue")}
        </Button>
      </Card>
    )
  }

  return (
    <Card padded elevated title={t("twofa.recovery.settings.remaining")}>
      <p className="amk-muted">
        {count ? `${count.remaining} of ${count.total} remaining` : "..."}
      </p>
      {!showRegen ? (
        <Button variant="secondary" size="sm" onClick={() => setShowRegen(true)}>
          {t("twofa.recovery.settings.regenerate")}
        </Button>
      ) : (
        <div className="amk-stack" style={{ marginTop: "var(--space-2)" }}>
          <Input label={t("passwords.setup.master")} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <p className="amk-field-error">{error}</p>}
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button loading={busy} onClick={() => void regenerate()}>
              {busy ? t("common.loading") : t("twofa.recovery.settings.regenerate")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowRegen(false); setPassword(""); setError(null) }}>
              {t("actions.cancel")}
            </Button>
          </div>
          <p className="amk-muted" style={{ fontSize: "var(--fs-xs)" }}>{t("twofa.recovery.settings.regenerate_confirm")}</p>
        </div>
      )}
    </Card>
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
  const [codes, setCodes] = useState<string[] | null>(null)
  const [ack, setAck] = useState(false)

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
      // extractable=true so wrapKey can bundle it into recovery codes
      const key = await deriveKey(password, salt, profile.kdf_iterations, true)
      try {
        const gen = await generateRecoveryCodes(key, 10)
        const stored = gen.stored.map((c) => ({
          code_hash: c.code_hash,
          salt: bytesToB64(c.salt),
          ciphertext: bytesToB64(c.ciphertext),
          iv: bytesToB64(c.iv),
        }))
        await api.createRecoveryCodes(stored)
        keepKey(key)
        setCodes(gen.codes)
        return
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("recovery code generation failed", e)
      }
      keepKey(key)
      onCreated()
    } catch (err) {
      setError(errorMessage(err, t("2fa.setup.err.create")))
    } finally {
      setBusy(false)
    }
  }

  if (codes) {
    return (
      <Card padded elevated title={t("twofa.recovery.setup.title")}>
        <p className="amk-muted">{t("twofa.recovery.setup.subtitle")}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--space-2)" }}>
          {codes.map((c, i) => (
            <code key={i} style={{ padding: "var(--space-2)", background: "var(--c-bg)", borderRadius: "var(--c-radius-sm)", fontFamily: "monospace", fontSize: "var(--fs-sm)" }}>
              {c}
            </code>
          ))}
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const blob = new Blob([codes.join("\n")], { type: "text/plain" })
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = "amanak-recovery-codes.txt"
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            {t("twofa.recovery.setup.download")}
          </Button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--c-text)" }}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>{t("twofa.recovery.setup.acknowledge")}</span>
        </label>
        <Button onClick={() => { if (ack) onCreated() }} disabled={!ack}>
          {t("twofa.recovery.setup.continue")}
        </Button>
      </Card>
    )
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
  onRecovered,
}: {
  profile: TwoFactorProfile
  autoLockNotice: boolean
  onUnlocked: () => void
  onRecovered: () => void
}) {
  const t = useT()
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [useRecovery, setUseRecovery] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState("")
  const [recovering, setRecovering] = useState(false)
  const [recoveredKey, setRecoveredKey] = useState<CryptoKey | null>(null)
  const [recoveredCodeHash, setRecoveredCodeHash] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [settingPassword, setSettingPassword] = useState(false)
  const attemptsRef = useRef(0)
  const firstFailRef = useRef<number | null>(null)
  const lockedUntilRef = useRef(0)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const lockedFor = Math.max(0, lockedUntilRef.current - now)
  const locked = lockedFor > 0

  async function submitNewPassword() {
    if (newPassword.length < 12) {
      setError(t("passwords.setup.err.weak"))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t("passwords.setup.err.mismatch"))
      return
    }
    if (!recoveredKey) return
    setSettingPassword(true)
    setError(null)
    try {
      const salt = generateSalt()
      const Knew = await deriveKey(newPassword, salt, PBKDF2_ITERATIONS)
      // fetch entries and re-encrypt each
      const entries = await api.listTwoFactorEntries()
      for (const e of entries) {
        const pt = await decrypt(recoveredKey, b64ToBytes(e.ciphertext), b64ToBytes(e.iv), aadFromEntryId(e.id))
        const { ciphertext, iv } = await (async () => {
          const iv = crypto.getRandomValues(new Uint8Array(12))
          const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: toBytes(aadFromEntryId(e.id)) }, Knew, toBytes(pt))
          return { ciphertext: new Uint8Array(ct), iv }
        })()
        await api.updateTwoFactorEntry(e.id, {
          label: e.label,
          issuer: e.issuer,
          ciphertext: bytesToB64(ciphertext),
          iv: bytesToB64(iv),
        })
      }
      // update profile kdf_salt
      await api.updateTwoFactorProfile({ kdf_salt: bytesToB64(salt) })
      if (recoveredCodeHash) {
        await api.completeRecoveryCode(recoveredCodeHash)
      }
      keepKey(Knew)
      setRecoveredKey(null)
      setRecoveredCodeHash(null)
      setNewPassword("")
      setConfirmPassword("")
      setUseRecovery(false)
      onRecovered()
    } catch (err) {
      setError(errorMessage(err, t("passwords.setup.err.create")))
    } finally {
      setSettingPassword(false)
    }
  }

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

  async function recover() {
    if (!recoveryCode.trim()) return
    setRecovering(true)
    setError(null)
    try {
      const normalized = recoveryCode.replace(/-/g, "").trim().toUpperCase()
      const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized))
      const hash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("")
      const res = await api.redeemRecoveryCode(hash)
      const salt = b64ToBytes(res.salt)
      const ciphertext = b64ToBytes(res.ciphertext)
      const iv = b64ToBytes(res.iv)
      const key = await unwrapKeyWithRecovery(recoveryCode, { salt, ciphertext, iv })
      setRecoveredKey(key)
      setRecoveredCodeHash(hash)
      setRecoveryCode("")
    } catch {
      setError(t("twofa.recovery.unlock.invalid"))
    } finally {
      setRecovering(false)
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

      <div style={{ marginTop: "var(--space-3)" }}>
        {!useRecovery ? (
          <Button variant="ghost" size="sm" onClick={() => setUseRecovery(true)}>
            {t("twofa.recovery.unlock.link")}
          </Button>
        ) : (
          <div className="amk-stack" style={{ marginTop: "var(--space-2)" }}>
            {!recoveredKey ? (
              <div className="amk-stack" data-testid="recovery-enter">
                <h3 style={{ margin: 0, color: "var(--c-text)", fontSize: "var(--fs-md)" }}>
                  {t("twofa.recovery.unlock.title")}
                </h3>
                <Input
                  label={t("twofa.recovery.unlock.input_label")}
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                />
                {error && <p className="amk-field-error">{error}</p>}
                <Button loading={recovering} onClick={() => void recover()}>
                  {recovering ? t("common.loading") : t("twofa.recovery.unlock.submit")}
                </Button>
              </div>
            ) : (
              <div className="amk-stack" data-testid="recovery-new-password">
                <h3 style={{ margin: 0, color: "var(--c-text)", fontSize: "var(--fs-md)" }}>
                  {t("twofa.recovery.unlock.new_password_prompt")}
                </h3>
                <p className="amk-muted">{t("twofa.recovery.unlock.new_password_body")}</p>
                <Input
                  label={t("passwords.setup.master")}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Input
                  label={t("passwords.setup.confirm")}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {error && <p className="amk-field-error">{error}</p>}
                <Button loading={settingPassword} onClick={() => void submitNewPassword()}>
                  {settingPassword ? t("common.loading") : t("twofa.recovery.unlock.success")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
