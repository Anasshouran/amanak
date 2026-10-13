import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  PASSWORD_CATEGORIES,
  type PasswordEntry,
  type PasswordVaultProfile,
} from "@amanak/shared-types"

import { aadFromEntryId } from "../crypto/aes"
import {
  MAX_LENGTH,
  MIN_LENGTH,
  defaultGeneratorOptions,
  generatePassword,
  scorePassword,
  strengthLabel,
  type PasswordGeneratorOptions,
} from "../crypto/generator"
import { PBKDF2_ITERATIONS, deriveKey, generateSalt } from "../crypto/kdf"
import {
  decryptPayload,
  encryptPayload,
  type CustomField,
  type PasswordPayload,
} from "../crypto/passwordPayload"
import { isUnlocked, lock as dropKey, unlock as keepKey, withKey } from "../crypto/unlock"
import { createVerification, verifyKey } from "../crypto/verification"
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Skeleton,
} from "../design/components"
import {
  IconCopy,
  IconDownload,
  IconEdit,
  IconEye,
  IconEyeOff,
  IconKey,
  IconLock,
  IconPasswords,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUpload,
} from "../design/icons"
import { useT } from "../design/i18n"
import { api } from "../lib/api"
import { errorCode, errorMessage, useAsync } from "../lib/useAsync"

/** The fixed category set (re-exported for reuse/tests). */
export const CATEGORIES = PASSWORD_CATEGORIES

const AUTO_LOCK_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000
const LOCKOUT_MS = 15 * 60 * 1000
const REVEAL_MS = 10 * 1000

/** Fixed zero AAD used by the portable export/import format. */
const EXPORT_AAD = aadFromEntryId(0)

type PasswordEntryMeta = {
  title: string
  username: string
  url: string
  category: string
  tags: string[]
}

type VaultBundle = {
  app: string
  type: string
  version: number
  kdf: {
    kdf_salt: string
    kdf_iterations: number
    kdf_algorithm: string
  }
  exported_at: string
  entries: Array<{
    title: string
    username: string
    url: string
    category: string
    tags: string[]
    ciphertext: string
    iv: string
  }>
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = ""
  for (const byte of bytes) bin += String.fromCharCode(byte)
  return btoa(bin)
}

function b64ToBytes(value: string): Uint8Array {
  const bin = atob(value)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function isValidUrl(value: string): boolean {
  if (!value.trim()) return true
  try {
    const parsed = new URL(value)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

async function decryptEntry(entry: PasswordEntry): Promise<PasswordPayload | null> {
  return withKey((key) =>
    decryptPayload(
      key,
      b64ToBytes(entry.ciphertext),
      b64ToBytes(entry.iv),
      aadFromEntryId(entry.id),
    ),
  )
}

type PasswordEntryMetaInput = {
  meta: {
    title: string
    username: string
    url: string
    category: string
    tags: string[]
  }
  payload: PasswordPayload
}

/**
 * Two-phase create: the entry's server-assigned id is the AES-GCM AAD, so a
 * placeholder blob is uploaded first and then re-encrypted with the real id.
 */
async function addEntryEncrypted(input: PasswordEntryMetaInput): Promise<PasswordEntry | null> {
  return withKey(async (key) => {
    const placeholder = await encryptPayload(key, input.payload, aadFromEntryId(0))
    const row = await api.createPasswordEntry({
      ...input.meta,
      ciphertext: bytesToB64(placeholder.ciphertext),
      iv: bytesToB64(placeholder.iv),
    })
    try {
      const bound = await encryptPayload(key, input.payload, aadFromEntryId(row.id))
      await api.updatePasswordEntry(row.id, {
        ciphertext: bytesToB64(bound.ciphertext),
        iv: bytesToB64(bound.iv),
      })
    } catch (err) {
      // The record would stay bound to AAD(0) and be unreadable — remove it.
      try {
        await api.deletePasswordEntry(row.id)
      } catch {
        // best effort
      }
      throw err
    }
    return row
  })
}

export function PasswordVault() {
  const t = useT()
  const [unlocked, setUnlocked] = useState(isUnlocked())
  const [autoLockNotice, setAutoLockNotice] = useState(false)

  const profile = useAsync<PasswordVaultProfile | null>(async () => {
    try {
      return await api.getPasswordVaultProfile()
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
        <PageHead />
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
        <PageHead />
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
      <PageHead>
        <Button
          variant="secondary"
          icon={<IconLock size={16} />}
          onClick={() => {
            dropKey()
            setUnlocked(false)
            setAutoLockNotice(false)
          }}
        >
          {t("passwords.lock")}
        </Button>
      </PageHead>
      <VaultList
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

function PageHead({ children }: { children?: ReactNode }) {
  const t = useT()
  return (
    <div className="amk-page-head">
      <div>
        <h1>
          <IconPasswords size={20} /> {t("passwords.title")}
        </h1>
        <p>{t("passwords.subtitle")}</p>
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

  async function submit() {
    if (password.length < 12) {
      setError(t("passwords.setup.err.weak"))
      return
    }
    if (password !== confirm) {
      setError(t("passwords.setup.err.mismatch"))
      return
    }
    if (!crypto.subtle) {
      setError(t("passwords.setup.err.crypto"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const salt = generateSalt()
      const key = await deriveKey(password, salt, PBKDF2_ITERATIONS)
      const verification = await createVerification(key)
      await api.createPasswordVaultProfile({
        kdf_salt: bytesToB64(salt),
        verification_iv: bytesToB64(verification.iv),
        verification_ciphertext: bytesToB64(verification.ciphertext),
      })
      keepKey(key)
      onCreated()
    } catch (err) {
      setError(errorMessage(err, t("passwords.setup.err.create")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card padded elevated title={t("passwords.setup.title")}>
      <p className="amk-muted">{t("passwords.setup.description")}</p>
      <form
        className="amk-stack"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <Input
          label={t("passwords.setup.master")}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label={t("passwords.setup.confirm")}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <p className="amk-muted">{t("passwords.setup.min")}</p>
        <p className="amk-note" role="note">
          {t("passwords.setup.warning")}
        </p>
        {error && (
          <p className="amk-field-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" loading={busy} icon={<IconKey size={16} />}>
          {t("passwords.setup.create")}
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
  profile: PasswordVaultProfile
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

  useEffect(() => {
    if (password) setError(null)
  }, [password])

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
      const salt = b64ToBytes(profile.kdf_salt)
      const key = await deriveKey(password, salt, profile.kdf_iterations)
      const ok = await verifyKey(
        key,
        b64ToBytes(profile.verification_iv),
        b64ToBytes(profile.verification_ciphertext),
      )
      if (!ok) throw new Error("wrong_password")
      keepKey(key)
      attemptsRef.current = 0
      firstFailRef.current = null
      onUnlocked()
    } catch {
      const failedAt = Date.now()
      if (firstFailRef.current === null || failedAt - firstFailRef.current > ATTEMPT_WINDOW_MS) {
        attemptsRef.current = 1
        firstFailRef.current = failedAt
      } else {
        attemptsRef.current += 1
      }
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        lockedUntilRef.current = Date.now() + LOCKOUT_MS
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

  return (
    <Card padded elevated title={t("passwords.unlock.title")}>
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
          label={t("passwords.unlock.label")}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error ?? undefined}
        />
        {locked && (
          <p className="amk-field-error" role="alert">
            {t("passwords.unlock.err.locked", {
              minutes: Math.max(1, Math.ceil(lockedFor / 60_000)),
            })}
          </p>
        )}
        <Button type="submit" loading={busy} icon={<IconKey size={16} />}>
          {busy ? t("passwords.unlock.working") : t("passwords.unlock.action")}
        </Button>
      </form>
    </Card>
  )
}

function VaultList({
  profile,
  onAutoLocked,
  onVaultDeleted,
}: {
  profile: PasswordVaultProfile
  onAutoLocked: () => void
  onVaultDeleted: () => void
}) {
  const t = useT()
  const [entries, setEntries] = useState<PasswordEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PasswordEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PasswordEntry | null>(null)
  const [deleteVaultOpen, setDeleteVaultOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  const reload = useCallback(() => setReloadNonce((n) => n + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    api
      .listPasswordEntries()
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
    if (!notice) return
    const id = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(id)
  }, [notice])

  const idleTimerRef = useRef<number>(0)
  useEffect(() => {
    function poke() {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = window.setTimeout(() => {
        dropKey()
        onAutoLocked()
      }, AUTO_LOCK_MS)
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

  const filtered = useMemo(() => {
    const rows = entries ?? []
    const needle = search.trim().toLowerCase()
    return rows.filter((entry) => {
      if (category !== "all" && entry.category !== category) return false
      if (!needle) return true
      return (
        entry.title.toLowerCase().includes(needle) ||
        entry.username.toLowerCase().includes(needle) ||
        entry.url.toLowerCase().includes(needle) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(needle))
      )
    })
  }, [entries, search, category])

  async function exportVault() {
    const bundle = await withKey(async (key) => {
      const rows = []
      for (const entry of entries ?? []) {
        const payload = await decryptPayload(
          key,
          b64ToBytes(entry.ciphertext),
          b64ToBytes(entry.iv),
          aadFromEntryId(entry.id),
        )
        const sealed = await encryptPayload(key, payload, aadFromEntryId(0))
        rows.push({
          title: entry.title,
          username: entry.username,
          url: entry.url,
          category: entry.category,
          tags: entry.tags,
          ciphertext: bytesToB64(sealed.ciphertext),
          iv: bytesToB64(sealed.iv),
        })
      }
      return {
        app: "amanak",
        type: "amanak-password-vault",
        version: 1,
        kdf: {
          kdf_salt: profile.kdf_salt,
          kdf_iterations: profile.kdf_iterations,
          kdf_algorithm: profile.kdf_algorithm,
        },
        exported_at: new Date().toISOString(),
        entries: rows,
      }
    })
    if (!bundle) return
    download(`${Date.now()}-amanak-vault.json`, JSON.stringify(bundle, null, 2))
    setNotice(t("passwords.export.hint", { count: String(bundle.entries.length) }))
  }

  async function importVault(file: File) {
    try {
      const text = await file.text()
      const data = JSON.parse(text) as { type?: string; entries?: Record<string, unknown>[] }
      if (data?.type !== "amanak-password-vault" || !Array.isArray(data.entries)) {
        throw new Error("bad-format")
      }
      const existing = new Set(
        (entries ?? []).map((entry) => `${entry.title}\u0000${entry.username}`),
      )
      let imported = 0
      let skipped = 0
      const ok = await withKey(async (key) => {
        for (const raw of data.entries ?? []) {
          const title = String(raw.title ?? "").trim()
          const username = String(raw.username ?? "")
          if (!title || typeof raw.ciphertext !== "string" || typeof raw.iv !== "string") {
            continue
          }
          const dedupeKey = `${title}\u0000${username}`
          if (existing.has(dedupeKey)) {
            skipped += 1
            continue
          }
          const payload = await decryptPayload(
            key,
            b64ToBytes(raw.ciphertext),
            b64ToBytes(raw.iv),
            aadFromEntryId(0),
          )
          await addEntryEncrypted({
            meta: {
              title,
              username,
              url: typeof raw.url === "string" ? raw.url : "",
              category: typeof raw.category === "string" ? raw.category : "",
              tags: Array.isArray(raw.tags) ? (raw.tags as unknown[]).map(String) : [],
            },
            payload,
          })
          existing.add(dedupeKey)
          imported += 1
        }
        return true
      })
      if (!ok) return
      setNotice(t("passwords.import.done", { imported, skipped }))
      reload()
    } catch {
      setNotice(t("passwords.import.err"))
    }
  }

  return (
    <>
      <div className="amk-stack">
        <div className="amk-row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div className="amk-row" style={{ gap: 6, flex: 1, minWidth: 220, alignItems: "center" }}>
            <IconSearch size={16} />
            <input
              className="amk-input"
              type="search"
              aria-label={t("passwords.search.placeholder")}
              placeholder={t("passwords.search.placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            icon={<IconDownload size={16} />}
            onClick={() => void exportVault()}
          >
            {t("passwords.export.action")}
          </Button>
          <Button
            variant="secondary"
            icon={<IconUpload size={16} />}
            onClick={() => importRef.current?.click()}
          >
            {t("passwords.import.action")}
          </Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importVault(file)
              event.target.value = ""
            }}
          />
        </div>

        <div className="amk-row" role="group" aria-label={t("passwords.field.category")}>
          <button
            type="button"
            className={`amk-chip${category === "all" ? " is-active" : ""}`}
            onClick={() => setCategory("all")}
          >
            {t("passwords.filter.all")}
          </button>
          {CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              className={`amk-chip${category === value ? " is-active" : ""}`}
              onClick={() => setCategory(value)}
            >
              {t(`passwords.category.${value}`)}
            </button>
          ))}
        </div>

        {notice && (
          <p className="amk-note" role="status">
            {notice}
          </p>
        )}

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
            icon={<IconPasswords size={30} />}
            title={t("passwords.list.empty.title")}
            description={t("passwords.list.empty.description")}
            action={
              <Button icon={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>
                {t("passwords.addEntry")}
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <p className="amk-muted">{t("passwords.list.empty.title")}</p>
        ) : (
          filtered.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onEdit={() => setEditTarget(entry)}
              onDelete={() => setDeleteTarget(entry)}
            />
          ))
        )}

        {entries && entries.length > 0 && (
          <Button icon={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>
            {t("passwords.addEntry")}
          </Button>
        )}

        <Card className="amk-card--danger" title={t("passwords.danger.title")}>
          <div className="amk-row" style={{ justifyContent: "space-between" }}>
            <span className="amk-muted">{t("passwords.deleteVault.description")}</span>
            <Button
              variant="danger"
              icon={<IconTrash size={16} />}
              onClick={() => setDeleteVaultOpen(true)}
            >
              {t("passwords.deleteVault.action")}
            </Button>
          </div>
        </Card>
      </div>

      <EntryModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false)
          reload()
        }}
      />

      <EntryModal
        open={editTarget !== null}
        entry={editTarget ?? undefined}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null)
          reload()
        }}
      />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("passwords.deleteEntry.title")}
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
                  await api.deletePasswordEntry(deleteTarget.id)
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
        <p>{t("passwords.deleteEntry.description")}</p>
      </Modal>

      <DeleteVaultModal
        open={deleteVaultOpen}
        onClose={() => setDeleteVaultOpen(false)}
        onDeleted={onVaultDeleted}
      />
    </>
  )
}

function EntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: PasswordEntry
  onEdit: () => void
  onDelete: () => void
}) {
  const t = useT()
  const [revealed, setRevealed] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (revealed === null) return
    const id = window.setTimeout(() => setRevealed(null), REVEAL_MS)
    return () => window.clearTimeout(id)
  }, [revealed])

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(id)
  }, [copied])

  async function reveal() {
    try {
      const payload = await decryptEntry(entry)
      if (payload) {
        setFailed(false)
        setRevealed(payload.password)
      } else {
        setFailed(true)
      }
    } catch {
      setFailed(true)
    }
  }

  async function copy() {
    try {
      const payload = await decryptEntry(entry)
      if (!payload) {
        setFailed(true)
        return
      }
      await navigator.clipboard.writeText(payload.password)
      setCopied(true)
    } catch {
      // Clipboard unavailable (e.g. insecure context) or decryption failed.
    }
  }

  return (
    <Card padded elevated title={entry.title}>
      <div className="amk-stack">
        <div
          className="amk-row"
          style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
        >
          <div className="amk-stack">
            {entry.username && <span className="amk-muted">{entry.username}</span>}
            {entry.url && (
              <a
                className="amk-muted"
                href={entry.url}
                target="_blank"
                rel="noreferrer noopener"
                dir="ltr"
              >
                {entry.url}
              </a>
            )}
          </div>
          <div className="amk-row" style={{ gap: 8, flexWrap: "wrap" }}>
            {entry.category && (
              <span className="amk-badge">{t(`passwords.category.${entry.category}`)}</span>
            )}
            {entry.tags.map((tag) => (
              <span key={tag} className="amk-badge">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="amk-row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <strong data-testid="password-reveal" dir="ltr">
            {revealed !== null ? revealed : "••••••••"}
          </strong>
          <Button variant="secondary" size="sm" onClick={() => void reveal()}>
            {revealed !== null ? (
              <>
                <IconEyeOff size={16} /> {t("passwords.hide")}
              </>
            ) : (
              <>
                <IconEye size={16} /> {t("passwords.show")}
              </>
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<IconCopy size={16} />}
            onClick={() => void copy()}
          >
            {copied ? t("passwords.copied") : t("passwords.copy")}
          </Button>
          <Button variant="ghost" size="sm" icon={<IconEdit size={16} />} onClick={onEdit}>
            {t("actions.edit")}
          </Button>
          <Button variant="ghost" size="sm" icon={<IconTrash size={16} />} onClick={onDelete}>
            {t("actions.delete")}
          </Button>
        </div>

        {revealed !== null && (
          <p className="amk-note" role="note">
            {t("passwords.revealWarning")}
          </p>
        )}
        {failed && (
          <p className="amk-field-error" role="alert">
            {t("passwords.revealFailed")}
          </p>
        )}
      </div>
    </Card>
  )
}

function GeneratorPanel({
  options,
  onChange,
  onGenerate,
  onUse,
}: {
  options: PasswordGeneratorOptions
  onChange: (next: PasswordGeneratorOptions) => void
  onGenerate: () => void
  onUse: () => void
}) {
  const t = useT()
  return (
    <div className="amk-stack">
      <strong>{t("passwords.gen.title")}</strong>
      <Input
        label={`${t("passwords.gen.length")}: ${options.length}`}
        type="range"
        min={MIN_LENGTH}
        max={MAX_LENGTH}
        value={options.length}
        onChange={(e) => onChange({ ...options, length: Number(e.target.value) })}
      />
      <div className="amk-row" style={{ gap: 12, flexWrap: "wrap" }}>
        <label className="amk-row" style={{ gap: 6 }}>
          <input
            type="checkbox"
            checked={options.lower}
            onChange={(e) => onChange({ ...options, lower: e.target.checked })}
          />
          {t("passwords.gen.lower")}
        </label>
        <label className="amk-row" style={{ gap: 6 }}>
          <input
            type="checkbox"
            checked={options.upper}
            onChange={(e) => onChange({ ...options, upper: e.target.checked })}
          />
          {t("passwords.gen.upper")}
        </label>
        <label className="amk-row" style={{ gap: 6 }}>
          <input
            type="checkbox"
            checked={options.digits}
            onChange={(e) => onChange({ ...options, digits: e.target.checked })}
          />
          {t("passwords.gen.digits")}
        </label>
        <label className="amk-row" style={{ gap: 6 }}>
          <input
            type="checkbox"
            checked={options.symbols}
            onChange={(e) => onChange({ ...options, symbols: e.target.checked })}
          />
          {t("passwords.gen.symbols")}
        </label>
        <label className="amk-row" style={{ gap: 6 }}>
          <input
            type="checkbox"
            checked={options.excludeAmbiguous}
            onChange={(e) => onChange({ ...options, excludeAmbiguous: e.target.checked })}
          />
          {t("passwords.gen.ambiguous")}
        </label>
      </div>
      <div className="amk-row" style={{ gap: 8 }}>
        <Button variant="secondary" icon={<IconRefresh size={16} />} onClick={onGenerate}>
          {t("passwords.gen.generate")}
        </Button>
        <Button onClick={onUse}>{t("passwords.gen.use")}</Button>
      </div>
    </div>
  )
}

function EntryModal({
  open,
  entry,
  onClose,
  onSaved,
}: {
  open: boolean
  entry?: PasswordEntry
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const [title, setTitle] = useState("")
  const [username, setUsername] = useState("")
  const [url, setUrl] = useState("")
  const [category, setCategory] = useState("")
  const [tagsText, setTagsText] = useState("")
  const [password, setPassword] = useState("")
  const [notes, setNotes] = useState("")
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [gen, setGen] = useState<PasswordGeneratorOptions>(defaultGeneratorOptions())
  const [genOpen, setGenOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setBusy(false)
    setGen(defaultGeneratorOptions())
    setGenOpen(false)
    if (!entry) {
      setTitle("")
      setUsername("")
      setUrl("")
      setCategory("")
      setTagsText("")
      setPassword("")
      setNotes("")
      setCustomFields([])
      return
    }
    setTitle(entry.title)
    setUsername(entry.username)
    setUrl(entry.url)
    setCategory(entry.category)
    setTagsText(entry.tags.join(", "))
    setPassword("")
    setNotes("")
    setCustomFields([])
    let active = true
    void decryptEntry(entry)
      .then((payload) => {
        if (!active || !payload) return
        setPassword(payload.password)
        setNotes(payload.notes)
        setCustomFields(payload.customFields)
      })
      .catch(() => {
        if (active) setError(t("passwords.revealFailed"))
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry])

  function updateField(index: number, changes: Partial<CustomField>) {
    setCustomFields((rows) => rows.map((row, i) => (i === index ? { ...row, ...changes } : row)))
  }

  function parseTags(): string[] {
    return tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20)
      .map((tag) => tag.slice(0, 32))
  }

  function applyGenerated() {
    if (!gen.lower && !gen.upper && !gen.digits && !gen.symbols) {
      setError(t("passwords.gen.empty"))
      return
    }
    setError(null)
    setPassword(generatePassword(gen))
  }

  async function save() {
    if (!title.trim()) {
      setError(t("passwords.err.title"))
      return
    }
    if (!isValidUrl(url)) {
      setError(t("passwords.err.url"))
      return
    }
    setBusy(true)
    setError(null)
    const meta: PasswordEntryMeta = {
      title: title.trim(),
      username: username.trim(),
      url: url.trim(),
      category,
      tags: parseTags(),
    }
    const payload: PasswordPayload = {
      password,
      notes,
      customFields: customFields.filter((field) => field.name.trim()),
    }
    try {
      if (entry) {
        const sealed = await withKey((key) =>
          encryptPayload(key, payload, aadFromEntryId(entry.id)),
        )
        if (!sealed) throw new Error(t("passwords.err.locked"))
        await api.updatePasswordEntry(entry.id, {
          ...meta,
          ciphertext: bytesToB64(sealed.ciphertext),
          iv: bytesToB64(sealed.iv),
        })
      } else {
        const created = await addEntryEncrypted({ meta, payload })
        if (!created) throw new Error(t("passwords.err.locked"))
      }
      onSaved()
    } catch (err) {
      setError(errorMessage(err, t("passwords.err.save")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={entry ? t("passwords.edit.title") : t("passwords.add.title")}
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
        <Input
          label={t("passwords.field.title")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          label={t("passwords.field.username")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          hint={t("common.optional")}
        />
        <Input
          label={t("passwords.field.url")}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          dir="ltr"
          hint={t("common.optional")}
        />

        <div className="amk-field">
          <label className="amk-label" htmlFor="password-vault-category">
            {t("passwords.field.category")}
          </label>
          <select
            id="password-vault-category"
            className="amk-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{t("common.none")}</option>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {t(`passwords.category.${value}`)}
              </option>
            ))}
          </select>
        </div>

        <Input
          label={t("passwords.field.tags")}
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          hint={t("passwords.field.tagsHint")}
        />

        <div className="amk-field">
          <label className="amk-label" htmlFor="password-vault-secret">
            {t("passwords.field.password")}
          </label>
          <div className="amk-row" style={{ gap: 8, flexWrap: "wrap" }}>
            <input
              id="password-vault-secret"
              className="amk-input"
              type="text"
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ flex: 1, minWidth: 160 }}
            />
            <Button variant="secondary" icon={<IconRefresh size={16} />} onClick={applyGenerated}>
              {t("passwords.gen.generate")}
            </Button>
            <Button variant="ghost" onClick={() => setGenOpen((value) => !value)}>
              {t("passwords.gen.title")}
            </Button>
          </div>
          {password && (
            <span className="amk-hint">
              {t(`passwords.strength.${strengthLabel(scorePassword(password))}`)} ·{" "}
              {scorePassword(password)}/100
            </span>
          )}
        </div>

        {genOpen && (
          <GeneratorPanel
            options={gen}
            onChange={setGen}
            onGenerate={applyGenerated}
            onUse={() => {
              applyGenerated()
              setGenOpen(false)
            }}
          />
        )}

        <div className="amk-field">
          <label className="amk-label" htmlFor="password-vault-notes">
            {t("passwords.field.notes")}
          </label>
          <textarea
            id="password-vault-notes"
            className="amk-input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="amk-stack">
          <strong>{t("passwords.field.custom")}</strong>
          {customFields.map((field, index) => (
            <div
              key={index}
              className="amk-row"
              style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}
            >
              <input
                className="amk-input"
                aria-label={t("passwords.custom.name")}
                placeholder={t("passwords.custom.name")}
                value={field.name}
                onChange={(e) => updateField(index, { name: e.target.value })}
              />
              <input
                className="amk-input"
                aria-label={t("passwords.custom.value")}
                placeholder={t("passwords.custom.value")}
                dir="ltr"
                value={field.value}
                onChange={(e) => updateField(index, { value: e.target.value })}
              />
              <label className="amk-row" style={{ gap: 4, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={field.sensitive}
                  onChange={(e) => updateField(index, { sensitive: e.target.checked })}
                />
                {t("passwords.custom.sensitive")}
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCustomFields((rows) => rows.filter((_, i) => i !== index))}
              >
                {t("passwords.custom.remove")}
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            icon={<IconPlus size={16} />}
            onClick={() =>
              setCustomFields((rows) => [...rows, { name: "", value: "", sensitive: false }])
            }
          >
            {t("passwords.custom.add")}
          </Button>
        </div>

        {error && (
          <p className="amk-field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

function DeleteVaultModal({
  open,
  onClose,
  onDeleted,
}: {
  open: boolean
  onClose: () => void
  onDeleted: () => void
}) {
  const t = useT()
  const [accountPassword, setAccountPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setAccountPassword("")
      setError(null)
      setBusy(false)
    }
  }, [open])

  async function confirm() {
    if (!accountPassword) {
      setError(t("passwords.deleteVault.err"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api.deletePasswordVaultProfile(accountPassword)
      onDeleted()
    } catch {
      setError(t("passwords.deleteVault.err"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("passwords.deleteVault.title")}
      actions={
        <div className="amk-modal__actions">
          <Button variant="secondary" onClick={onClose}>
            {t("actions.cancel")}
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void confirm()}>
            {t("actions.delete")}
          </Button>
        </div>
      }
    >
      <div className="amk-stack">
        <p>{t("passwords.deleteVault.description")}</p>
        <Input
          label={t("passwords.deleteVault.account")}
          type="password"
          autoComplete="current-password"
          value={accountPassword}
          onChange={(e) => setAccountPassword(e.target.value)}
          hint={t("passwords.deleteVault.accountHint")}
          error={error ?? undefined}
        />
      </div>
    </Modal>
  )
}
