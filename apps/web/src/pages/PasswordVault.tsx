import { useEffect, useRef, useState, type ReactNode } from "react"
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
import { isUnlocked, lock as dropKey, unlock, withKey } from "../crypto/unlock"
import { createVerification, verifyKey } from "../crypto/verification"
import {
  Button,
  Card,
  ErrorState,
  Input,
  Modal,
  Skeleton,
  useToast,
} from "../design/components"
import {
  IconKey,
  IconLock,
  IconPasswords,
  IconPlus,
  IconTrash,
} from "../design/icons"
import { useT } from "../design/i18n"
import { api } from "../lib/api"
import { PasswordEntryList } from "../components/vault/PasswordEntryList"
import { PasswordEditModal } from "../components/vault/PasswordEditModal"
import { EntryModal } from "../components/vault/EntryModal"
import { VaultLockScreen } from "../components/vault/VaultLockScreen"

import { errorCode, errorMessage, useAsync } from "../lib/useAsync"

/** The fixed category set (re-exported for reuse/tests). */
export const CATEGORIES = PASSWORD_CATEGORIES

const AUTO_LOCK_MS = 5 * 60 * 1000

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

type EditableEntry = PasswordEntry & {
  password: string
  notes: string
  customFields: CustomField[]
}

export function PasswordVault() {
  const t = useT()
  const toast = useToast()
  const [unlocked, setUnlocked] = useState(isUnlocked())
  const [autoLockNotice, setAutoLockNotice] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<EditableEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PasswordEntry | null>(null)
  const [deleteVaultOpen, setDeleteVaultOpen] = useState(false)
  const [entries, setEntries] = useState<PasswordEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  const profile = useAsync<PasswordVaultProfile | null>(async () => {
    try {
      return await api.getPasswordVaultProfile()
    } catch (err) {
      if (errorCode(err) === "not_found") return null
      throw err
    }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    api
      .listPasswordEntries()
      .then((data) => {
        if (active) setEntries(data)
        if (active) setLoading(false)
      })
      .catch((err) => {
        if (active) setError(err)
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadNonce])

  // Inactivity auto-lock: drop the in-memory key after five idle minutes.
  const idleTimerRef = useRef<number>(0)
  useEffect(() => {
    if (!unlocked) return
    function poke() {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = window.setTimeout(() => {
        dropKey()
        setUnlocked(false)
        setAutoLockNotice(true)
      }, AUTO_LOCK_MS)
    }
    poke()
    const events = ["pointerdown", "keydown", "scroll", "wheel", "touchstart"] as const
    events.forEach((name) => window.addEventListener(name, poke, { passive: true }))
    return () => {
      events.forEach((name) => window.removeEventListener(name, poke))
      window.clearTimeout(idleTimerRef.current)
    }
  }, [unlocked])

  async function exportVault() {
    if (entries == null || entries.length === 0 || !profile.data) return
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
          kdf_salt: profile.data?.kdf_salt ?? "",
          kdf_iterations: profile.data?.kdf_iterations ?? 310000,
          kdf_algorithm: profile.data?.kdf_algorithm ?? "PBKDF2-SHA256",
        },
        exported_at: new Date().toISOString(),
        entries: rows,
      }
    })
    if (!bundle) return
    const data = JSON.stringify(bundle, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${Date.now()}-amanak-vault.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
    toast.push(t("vault.exported"), "success")
  }



  const reload = () => setReloadNonce((n) => n + 1)
  async function saveEntry(values: {
    title: string
    username: string
    password: string
    url: string
    notes: string
    category: string
  }) {
    const payload: PasswordPayload = {
      password: values.password,
      notes: values.notes,
      customFields: [],
    }
    const created = await addEntryEncrypted({
      meta: {
        title: values.title,
        username: values.username,
        url: values.url,
        category: values.category,
        tags: [],
      },
      payload,
    })
    if (created) {
      reload()
    }
  }

  async function revealPassword(entry: PasswordEntry): Promise<string | null> {
    const payload = await decryptEntry(entry)
    return payload ? payload.password : null
  }

  async function openEdit(entry: PasswordEntry) {
    const payload = await decryptEntry(entry)
    if (!payload) return
    setEditTarget({
      ...entry,
      password: payload.password,
      notes: payload.notes,
      customFields: payload.customFields,
    })
  }

  async function saveEdit(values: {
    title: string
    username: string
    password: string
    url: string
    notes: string
    category: string
  }) {
    const target = editTarget
    if (!target) return
    const payload: PasswordPayload = {
      password: values.password,
      notes: values.notes,
      customFields: target.customFields,
    }
    const sealed = await withKey((key) =>
      encryptPayload(key, payload, aadFromEntryId(target.id)),
    )
    if (!sealed) return
    await api.updatePasswordEntry(target.id, {
      title: values.title,
      username: values.username,
      url: values.url,
      category: values.category,
      tags: target.tags,
      ciphertext: bytesToB64(sealed.ciphertext),
      iv: bytesToB64(sealed.iv),
    })
    setEditTarget(null)
    reload()
  }

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
        <VaultLockScreen
          profile={profile.data}
          autoLockNotice={autoLockNotice}
          onUnlocked={() => {
            setUnlocked(true)
            setAutoLockNotice(false)
          }}
          verify={async (password: string, vaultProfile: PasswordVaultProfile) => {
            const salt = b64ToBytes(vaultProfile.kdf_salt)
            const key = await deriveKey(password, salt, vaultProfile.kdf_iterations)
            const ok = await verifyKey(
              key,
              b64ToBytes(vaultProfile.verification_iv),
              b64ToBytes(vaultProfile.verification_ciphertext),
            )
            if (!ok) throw new Error("wrong_password")
            unlock(key)
          }}
        />
      </div>
    )
  }

  const displayEntries = loading ? [] : (entries ?? [])

  return (
    <div className="amk-page">
      <PageHead>
        <div className="amk-row">
          <Button
            variant="secondary"
            icon={<IconLock size={16} />}
            onClick={() => {
              dropKey()
              setUnlocked(false)
              setAutoLockNotice(false)
            }}
          >
            {t("vault.lock")}
          </Button>
          <Button icon={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>
            {t("vault.add")}
          </Button>
        </div>
      </PageHead>
      <PasswordEntryList
        entries={displayEntries}
        loading={loading}
        error={error}
        onAdd={() => setAddOpen(true)}
        onEdit={(entry) => void openEdit(entry)}
        onDelete={(entry) => setDeleteTarget(entry)}
        onRevealPassword={revealPassword}
        onExport={profile.data && (entries?.length ?? 0) > 0 ? exportVault : undefined}
        onReload={reload}
      />
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
      <EntryModal
        open={addOpen}
        mode="add"
        onClose={() => setAddOpen(false)}
        onSave={async (values) => {
          await saveEntry(values)
          setAddOpen(false)
        }}
        busy={loading}
        error={error ? String(error) : null}
      />
      <PasswordEditModal
        open={editTarget !== null}
        entry={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={(values) => void saveEdit(values)}
      />
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("vault.delete.confirm_title")}
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
        <p>{t("vault.delete.confirm_body")}</p>
      </Modal>
      <DeleteVaultModal
        open={deleteVaultOpen}
        onClose={() => setDeleteVaultOpen(false)}
        onDeleted={() => {
          setDeleteVaultOpen(false)
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
          <IconPasswords size={20} /> {t("vault.title")}
        </h1>
        <p>{t("vault.subtitle")}</p>
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
      unlock(key)
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
