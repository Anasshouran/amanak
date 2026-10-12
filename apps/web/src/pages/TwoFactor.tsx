import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import jsQR from "jsqr"
import type { TwoFactorEntry, TwoFactorProfile } from "@amanak/shared-types"

import { aadFromEntryId, decrypt, encrypt } from "../crypto/aes"
import { decode as base32Decode } from "../crypto/base32"
import { deriveKey, generateSalt } from "../crypto/kdf"
import { generateTotp } from "../crypto/totp"
import { isUnlocked, lock as dropKey, unlock as keepKey, withKey } from "../crypto/unlock"
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  ProgressRing,
  Skeleton,
  Tabs,
} from "../design/components"
import { useT } from "../design/i18n"
import { IconCopy, IconEdit, IconKey, IconLock, IconPlus, IconTrash } from "../design/icons"
import { api } from "../lib/api"
import { errorCode, errorMessage, useAsync } from "../lib/useAsync"

const AUTO_LOCK_MS = 5 * 60 * 1000
const TOTP_STEP_MS = 30_000

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

/**
 * AAD bind: entries are encrypted with AES-GCM AAD = the entry's server-side id
 * so a ciphertext blob can never be swapped between entries. A brand-new entry
 * must first be created (the server assigns the id) and is then immediately
 * re-encrypted with its real id.
 */
async function addEntryEncrypted(input: { label: string; issuer?: string; secret: Uint8Array }) {
  return withKey(async (key) => {
    const placeholder = await encrypt(key, input.secret, aadFromEntryId(0))
    const created = await api.createTwoFactorEntry({
      label: input.label,
      issuer: input.issuer,
      ciphertext: bytesToB64(placeholder.ciphertext),
      iv: bytesToB64(placeholder.iv),
    })
    try {
      const bound = await encrypt(key, input.secret, aadFromEntryId(created.id))
      await api.updateTwoFactorEntry(created.id, {
        ciphertext: bytesToB64(bound.ciphertext),
        iv: bytesToB64(bound.iv),
      })
    } catch (err) {
      // The record would be bound to AAD(0) and unreadable — remove it.
      try {
        await api.deleteTwoFactorEntry(created.id)
      } catch {
        // best effort
      }
      throw err
    }
    return created
  })
}

type OtpauthData = { label: string; issuer?: string; secret: string }

function parseOtpauth(uri: string): OtpauthData | null {
  try {
    const u = new URL(uri)
    if (u.protocol !== "otpauth:" || u.pathname.split("/")[1] !== "totp") return null
    const secret = u.searchParams.get("secret") ?? ""
    if (!secret) return null
    let label = decodeURIComponent(u.pathname.split("/").slice(2).join("/"))
    let issuer = u.searchParams.get("issuer") ?? undefined
    if (!issuer && label.includes(":")) {
      const [prefix, ...rest] = label.split(":")
      issuer = prefix
      label = rest.join(":")
    }
    if (!label) return null
    return { label, issuer, secret: secret.trim() }
  } catch {
    return null
  }
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
      <VaultList
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

function VaultList({
  onAutoLocked,
  onVaultDeleted,
}: {
  onAutoLocked: () => void
  onVaultDeleted: () => void
}) {
  const t = useT()
  const [entries, setEntries] = useState<TwoFactorEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TwoFactorEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TwoFactorEntry | null>(null)
  const [deleteVaultOpen, setDeleteVaultOpen] = useState(false)
  const [deletingVault, setDeletingVault] = useState(false)

  const reload = useCallback(() => setReloadNonce((n) => n + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    api
      .listTwoFactorEntries()
      .then((data) => {
        if (active) setEntries(data)
      })
      .catch((err) => {
        if (active) setError(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadNonce])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Auto-lock after 5 minutes of inactivity while the vault is open.
  const idleTimerRef = useRef<number>(0)
  useEffect(() => {
    function poke() {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = window.setTimeout(lockAfterIdle, AUTO_LOCK_MS)
    }
    poke()
    const events = ["pointerdown", "keydown", "scroll", "wheel", "touchstart"] as const
    events.forEach((name) => window.addEventListener(name, poke, { passive: true }))
    return () => {
      events.forEach((name) => window.removeEventListener(name, poke))
      window.clearTimeout(idleTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function lockAfterIdle() {
    dropKey()
    onAutoLocked()
  }

  async function deleteVault() {
    setDeletingVault(true)
    try {
      await api.deleteTwoFactorProfile()
      onVaultDeleted()
    } finally {
      setDeletingVault(false)
      setDeleteVaultOpen(false)
    }
  }

  return (
    <>
      <div className="amk-stack">
        {loading && !entries ? (
          <>
            <Skeleton height={96} />
            <Skeleton height={96} />
          </>
        ) : error ? (
          <ErrorState
            title={t("common.error")}
            message={errorMessage(error, t("common.error"))}
            onRetry={reload}
            retryLabel={t("actions.retry")}
          />
        ) : entries && entries.length === 0 ? (
          <EmptyState
            icon={<IconKey size={30} />}
            title={t("2fa.list.empty.title")}
            description={t("2fa.list.empty.description")}
            action={
              <Button icon={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>
                {t("2fa.addEntry")}
              </Button>
            }
          />
        ) : (
          entries?.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              now={now}
              onEdit={() => setEditTarget(entry)}
              onDelete={() => setDeleteTarget(entry)}
            />
          ))
        )}

        {entries && entries.length > 0 && (
          <Button icon={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>
            {t("2fa.addEntry")}
          </Button>
        )}

        <Card className="amk-card--danger" title={t("2fa.danger.title")}>
          <div className="amk-row" style={{ justifyContent: "space-between" }}>
            <span className="amk-muted">{t("2fa.deleteVault.description")}</span>
            <Button variant="danger" icon={<IconTrash size={16} />} onClick={() => setDeleteVaultOpen(true)}>
              {t("2fa.deleteVault.action")}
            </Button>
          </div>
        </Card>
      </div>

      <AddModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false)
          reload()
        }}
      />

      <EditModal
        entry={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null)
          reload()
        }}
      />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("2fa.deleteEntry.title")}
        actions={
          <div className="amk-modal__actions">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("actions.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!deleteTarget) return
                try {
                  await api.deleteTwoFactorEntry(deleteTarget.id)
                } finally {
                  setDeleteTarget(null)
                  reload()
                }
              }}
            >
              {t("actions.delete")}
            </Button>
          </div>
        }
      >
        <p>{t("2fa.deleteEntry.description")}</p>
      </Modal>

      <Modal
        open={deleteVaultOpen}
        onClose={() => setDeleteVaultOpen(false)}
        title={t("2fa.deleteVault.title")}
        actions={
          <div className="amk-modal__actions">
            <Button variant="secondary" onClick={() => setDeleteVaultOpen(false)}>
              {t("actions.cancel")}
            </Button>
            <Button variant="danger" loading={deletingVault} onClick={() => void deleteVault()}>
              {t("actions.delete")}
            </Button>
          </div>
        }
      >
        <p>{t("2fa.deleteVault.description")}</p>
      </Modal>
    </>
  )
}

function EntryCard({
  entry,
  now,
  onEdit,
  onDelete,
}: {
  entry: TwoFactorEntry
  now: number
  onEdit: () => void
  onDelete: () => void
}) {
  const t = useT()
  const [code, setCode] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const step = Math.floor(now / 1000 / 30)
  const secondsRemaining = Math.floor((TOTP_STEP_MS - (now % TOTP_STEP_MS)) / 1000)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await withKey(async (key) => {
        const plain = await decrypt(
          key,
          b64ToBytes(entry.ciphertext),
          b64ToBytes(entry.iv),
          aadFromEntryId(entry.id),
        )
        return generateTotp(plain, step * 30_000)
      })
      if (!cancelled) {
        if (result) {
          setCode(result)
          setFailed(false)
        } else {
          setFailed(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [entry.id, entry.ciphertext, entry.iv, step])

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(id)
  }, [copied])

  async function copy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      // clipboard unavailable (e.g. insecure context)
    }
  }

  const title = entry.issuer ? `${entry.issuer} · ${entry.label}` : entry.label

  return (
    <Card padded elevated className="amk-2fa-entry" title={title}>
      <div className="amk-row amk-2fa-entry__body">
        <div className="amk-2fa-entry__code">
          {failed && !code ? (
            <Skeleton height={28} width={110} />
          ) : (
            <strong className="amk-2fa-code" aria-live="polite" data-testid="totp-code">
              {code ?? "·····"}
            </strong>
          )}
          <ProgressRing
            size={44}
            stroke={4}
            value={Math.round((secondsRemaining / 30) * 100)}
            label=""
            caption=""
          />
        </div>
        <div className="amk-2fa-entry__actions">
          <Button
            variant="secondary"
            size="sm"
            icon={<IconCopy size={14} />}
            onClick={() => void copy()}
          >
            {copied ? t("2fa.copied") : t("2fa.copy")}
          </Button>
          <Button variant="secondary" size="sm" icon={<IconEdit size={14} />} onClick={onEdit} aria-label={t("actions.edit")} />
          <Button variant="ghost" size="sm" icon={<IconTrash size={14} />} onClick={onDelete} aria-label={t("actions.delete")} />
        </div>
      </div>
    </Card>
  )
}

function AddModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const [tab, setTab] = useState("manual")
  const [label, setLabel] = useState("")
  const [issuer, setIssuer] = useState("")
  const [secret, setSecret] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!label.trim()) {
      setError(t("2fa.add.err.label"))
      return
    }
    let secretBytes: Uint8Array
    try {
      secretBytes = base32Decode(secret.replace(/\s+/g, ""))
    } catch {
      setError(t("2fa.add.err.invalid"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await addEntryEncrypted({
        label: label.trim(),
        issuer: issuer.trim() || undefined,
        secret: secretBytes,
      })
      onSaved()
    } catch (err) {
      setError(errorMessage(err, t("2fa.add.err.create")))
    } finally {
      setBusy(false)
    }
  }

  async function onImageFile(file: File) {
    setError(null)
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("no-2d-context")
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const result = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        })
        const parsed = result?.data ? parseOtpauth(result.data) : null
        if (!parsed) {
          setError(t("2fa.add.err.notTotp"))
          return
        }
        setLabel(parsed.label)
        setIssuer(parsed.issuer ?? "")
        setSecret(parsed.secret)
        setTab("manual")
      } catch {
        setError(t("2fa.add.err.unreadable"))
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }
    img.onerror = () => {
      setError(t("2fa.add.err.unreadable"))
      URL.revokeObjectURL(objectUrl)
    }
    img.src = objectUrl
  }

  useEffect(() => {
    if (!open) {
      setLabel("")
      setIssuer("")
      setSecret("")
      setError(null)
      setTab("manual")
      setBusy(false)
    }
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("2fa.add.title")}
      actions={
        <div className="amk-modal__actions">
          <Button variant="secondary" onClick={onClose}>
            {t("actions.cancel")}
          </Button>
          <Button icon={<IconPlus size={16} />} loading={busy} onClick={() => void save()}>
            {t("2fa.add.save")}
          </Button>
        </div>
      }
    >
      <div className="amk-stack">
        <Tabs
          items={[
            { id: "manual", label: t("2fa.add.manual") },
            { id: "scan", label: t("2fa.add.scan") },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === "manual" ? (
          <div className="amk-stack">
            <Input label={t("2fa.add.label")} value={label} onChange={(e) => setLabel(e.target.value)} />
            <Input label={t("2fa.add.issuer")} value={issuer} onChange={(e) => setIssuer(e.target.value)} hint={t("common.optional")} />
            <Input
              label={t("2fa.add.secret")}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="JBSWY3DPEHPK3PXP"
              dir="ltr"
            />
          </div>
        ) : (
          <div className="amk-stack">
            <p className="amk-muted">{t("2fa.add.scanHint")}</p>
            <label className="amk-file">
              <IconKey size={16} />
              <span>{t("2fa.add.chooseImage")}</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void onImageFile(file)
                  e.target.value = ""
                }}
              />
            </label>
          </div>
        )}
        {error && (
          <p className="amk-field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

function EditModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: TwoFactorEntry | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const [label, setLabel] = useState("")
  const [issuer, setIssuer] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLabel(entry?.label ?? "")
    setIssuer(entry?.issuer ?? "")
    setError(null)
  }, [entry])

  async function save() {
    if (!entry) return
    if (!label.trim()) {
      setError(t("2fa.add.err.label"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.updateTwoFactorEntry(entry.id, {
        label: label.trim(),
        issuer: issuer.trim(),
      })
      onSaved()
    } catch (err) {
      setError(errorMessage(err, t("2fa.add.err.create")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={entry !== null}
      onClose={onClose}
      title={t("2fa.edit.title")}
      actions={
        <div className="amk-modal__actions">
          <Button variant="secondary" onClick={onClose}>
            {t("actions.cancel")}
          </Button>
          <Button loading={busy} onClick={() => void save()}>
            {t("actions.save")}
          </Button>
        </div>
      }
    >
      <div className="amk-stack">
        <Input label={t("2fa.add.label")} value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input label={t("2fa.add.issuer")} value={issuer} onChange={(e) => setIssuer(e.target.value)} hint={t("common.optional")} />
        {error && (
          <p className="amk-field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}