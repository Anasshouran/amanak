import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert, Clipboard, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native"
import type { PasswordEntry, PasswordVaultProfile } from "@amanak/shared-types"
import { Header } from "../../components/Header"
import { VaultLockScreenMobile } from "../../components/vault/VaultLockScreenMobile"
import { PasswordEntryListMobile } from "../../components/vault/PasswordEntryListMobile"
import { EntryModalMobile } from "../../components/vault/EntryModalMobile"
import { useLocale } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"
import { api } from "../../lib/api"
import { b64Decode, b64Encode } from "../../lib/vault/bytes"
import { decryptPayload, encryptPayload } from "../../lib/vault/passwordPayload"
import { randomBytes } from "../../lib/vault/random"
import { aadFromEntryId, deriveKeyBytes } from "../../lib/vault/vault"
import { createVerification, verifyKey } from "../../lib/vault/verification"

const AUTO_LOCK_MS = 5 * 60 * 1000
const MIN_PASSWORD_LENGTH = 12

function errorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: unknown }).code)
  }
  return undefined
}

function messageOf(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message
  }
  return fallback
}

function parseTags(value: string): string[] {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20).map((tag) => tag.slice(0, 32))
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

/** Shared page shell: header + padded scroll area, matching the P17.6a screens. */
function ScreenShell({ title, children }: { title: string; children: React.ReactNode }) {
  const tokens = useTokens()
  return (
    <View style={{ flex: 1, backgroundColor: tokens.c.bg }}>
      <Header title={title} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: tokens.space[4], paddingBottom: tokens.space[12], gap: tokens.space[4] }}>
        {children}
      </ScrollView>
    </View>
  )
}

/**
 * Password Vault — mobile parity with the web P17.4b vault.
 *
 * State machine: no profile → setup wizard; profile but no key → unlock;
 * key held → entry list. Every secret stays a server-blind blob; `lib/vault/**`
 * is only read, never modified.
 */
export default function Passwords() {
  const tokens = useTokens()
  const { t, isRTL } = useLocale()

  const [profile, setProfile] = useState<PasswordVaultProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState<Uint8Array | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [entries, setEntries] = useState<PasswordEntry[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PasswordEntry | null>(null)
  const [deleteVaultOpen, setDeleteVaultOpen] = useState(false)
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("")

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProfile(await api.getPasswordVaultProfile())
    } catch (err) {
      if (errorCode(err) === "not_found") setProfile(null)
      else setError(messageOf(err, t("common.error")))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  const lock = useCallback(() => {
    setKey(null)
    setNotice(null)
  }, [])

  // Inactivity auto-lock: drop the in-memory key after five idle minutes.
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pokeRef = useRef<() => void>(() => {})
  useEffect(() => {
    pokeRef.current = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => {
        lock()
        setNotice(t("vault.autoLocked"))
      }, AUTO_LOCK_MS)
    }
    pokeRef.current()
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [lock, t])

  async function unlockKey(password: string, profile: PasswordVaultProfile): Promise<void> {
    const salt = b64Decode(profile.kdf_salt)
    const derivedKey = deriveKeyBytes(password, salt, profile.kdf_iterations)
    const ok = verifyKey(derivedKey, b64Decode(profile.verification_iv), b64Decode(profile.verification_ciphertext))
    if (!ok) throw new Error("wrong_password")
    setKey(derivedKey)
  }

  async function reloadEntries() {
    setLoading(true)
    setError(null)
    try {
      setEntries(await api.listPasswordEntries())
    } catch (err) {
      setError(messageOf(err, t("common.error")))
    } finally {
      setLoading(false)
    }
  }

  async function addEntryEncrypted(values: {
    title: string
    username: string
    password: string
    url: string
    notes: string
    category: string
  }) {
    const keyValue = key
    if (!keyValue) return
    const payload = { password: values.password, notes: values.notes, customFields: [] }
    const placeholderIv = randomBytes(12)
    const placeholder = await encryptPayload(keyValue, payload, aadFromEntryId(0), placeholderIv)
    const row = await api.createPasswordEntry({
      title: values.title,
      username: values.username,
      url: values.url,
      category: values.category,
      tags: [],
      ciphertext: b64Encode(placeholder),
      iv: b64Encode(placeholderIv),
    })
    try {
      const boundIv = randomBytes(12)
      const bound = await encryptPayload(keyValue, payload, aadFromEntryId(row.id), boundIv)
      await api.updatePasswordEntry(row.id, {
        ciphertext: b64Encode(bound),
        iv: b64Encode(boundIv),
      })
    } catch {
      try {
        await api.deletePasswordEntry(row.id)
      } catch {
        /* best effort */
      }
      throw new Error(t("passwords.setup.err.create"))
    }
  }

  async function saveEdit(entry: PasswordEntry, values: {
    title: string
    username: string
    password: string
    url: string
    notes: string
    category: string
  }) {
    const keyValue = key
    if (!keyValue) return
    const payload = { password: values.password, notes: values.notes, customFields: [] }
    const sealIv = randomBytes(12)
    const sealed = await encryptPayload(keyValue, payload, aadFromEntryId(entry.id), sealIv)
    await api.updatePasswordEntry(entry.id, {
      title: values.title,
      username: values.username,
      url: values.url,
      category: values.category,
      tags: entry.tags,
      ciphertext: b64Encode(sealed),
      iv: b64Encode(sealIv),
    })
  }

  async function revealPassword(entry: PasswordEntry): Promise<string | null> {
    const keyValue = key
    if (!keyValue) return null
    try {
      const payload = await decryptPayload(keyValue, b64Decode(entry.ciphertext), b64Decode(entry.iv), aadFromEntryId(entry.id))
      return payload.password
    } catch {
      return null
    }
  }

  async function deleteEntry(entry: PasswordEntry) {
    await api.deletePasswordEntry(entry.id)
    await reloadEntries()
  }

  async function deleteVault() {
    await api.deletePasswordVaultProfile(deleteAccountPassword)
    setDeleteVaultOpen(false)
    setDeleteAccountPassword("")
    setKey(null)
    setProfile(null)
    setEntries([])
    await reloadEntries()
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.c.bg }}>
        <Text style={{ color: tokens.c.muted }}>{t("common.loading")}</Text>
      </View>
    )
  }

  if (error) {
    return (
      <ScreenShell title={t("vault.title")}>
        <Text accessibilityRole="alert" style={{ color: tokens.c.danger, textAlign: "center" }}>
          {error}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => void loadProfile()} style={{ padding: tokens.space[2] }}>
          <Text style={{ color: tokens.c.brand, fontWeight: "600" }}>{t("actions.retry")}</Text>
        </Pressable>
      </ScreenShell>
    )
  }

  if (!profile) {
    return (
      <ScreenShell title={t("passwords.setup.title")}>
        <SetupScreen onCreated={async (password) => {
          const salt = randomBytes(32)
          const derivedKey = deriveKeyBytes(password, salt)
          const verification = createVerification(derivedKey, randomBytes(12))
          const created = await api.createPasswordVaultProfile({
            kdf_salt: b64Encode(salt),
            verification_iv: b64Encode(verification.iv),
            verification_ciphertext: b64Encode(verification.ciphertext),
          })
          setProfile(created)
          setKey(derivedKey)
        }} />
      </ScreenShell>
    )
  }

  if (!key) {
    return (
      <ScreenShell title={t("vault.locked.title")}>
        <VaultLockScreenMobile profile={profile} autoLockNotice={!!notice} onUnlocked={() => { setNotice(null) }} verify={unlockKey} />
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title={t("vault.title")}>
      <View style={{ gap: tokens.space[2] }}>
        <Text style={{ color: tokens.c.textStrong, fontWeight: "700", fontSize: tokens.size.lg }}>{t("vault.title")}</Text>
        <Text style={{ color: tokens.c.muted }}>{t("vault.subtitle")}</Text>
      </View>

      <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "center", gap: tokens.space[3] }}>
        <Pressable accessibilityRole="button" onPress={lock} style={{ paddingHorizontal: tokens.space[4], paddingVertical: tokens.space[2], borderRadius: tokens.radius.md, borderWidth: 1, borderColor: tokens.c.borderStrong }}>
          <Text style={{ color: tokens.c.text, fontWeight: "600" }}>{t("vault.lock")}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setAddOpen(true)} style={{ backgroundColor: tokens.c.brand, paddingHorizontal: tokens.space[4], paddingVertical: tokens.space[2], borderRadius: tokens.radius.md }}>
          <Text style={{ color: tokens.c.brandContrast, fontWeight: "700" }}>{t("vault.add")}</Text>
        </Pressable>
      </View>

      <PasswordEntryListMobile
        entries={entries}
        loading={loading}
        error={error}
        onAdd={() => setAddOpen(true)}
        onEdit={(entry) => void setEditTarget(entry)}
        onDelete={deleteEntry}
        onRevealPassword={revealPassword}
        onReload={reloadEntries}
      />

      <View
        style={{
          borderWidth: 1,
          borderColor: tokens.c.danger,
          borderRadius: tokens.radius.md,
          padding: tokens.space[4],
          gap: tokens.space[2],
          marginTop: tokens.space[2],
        }}
      >
        <Text style={{ color: tokens.c.textStrong, fontWeight: "700", textAlign: "left" }}>{t("passwords.danger.title")}</Text>
        <Text style={{ color: tokens.c.muted }}>{t("passwords.deleteVault.description")}</Text>
        <Pressable accessibilityRole="button" onPress={() => setDeleteVaultOpen(true)} style={{ paddingVertical: tokens.space[2], alignItems: "flex-start" }}>
          <Text style={{ color: tokens.c.danger, fontWeight: "700" }}>{t("passwords.deleteVault.action")}</Text>
        </Pressable>
      </View>

      <EntryModalMobile
        open={addOpen}
        mode="add"
        onClose={() => setAddOpen(false)}
        onSave={async (values) => {
          if (!values.title.trim()) return
          if (!isValidUrl(values.url)) return
          try {
            await addEntryEncrypted(values)
            setAddOpen(false)
            await reloadEntries()
          } catch (err) {
            setError(messageOf(err, t("common.error")))
          }
        }}
      />

      {editTarget && (
        <EntryModalMobile
          open
          mode="edit"
          initialTitle={editTarget.title}
          initialUsername={editTarget.username ?? ""}
          initialPassword=""
          initialUrl={editTarget.url ?? ""}
          initialNotes=""
          initialCategory={editTarget.category}
          onClose={() => setEditTarget(null)}
          onSave={async (values) => {
            if (!values.title.trim()) return
            if (!isValidUrl(values.url)) return
            try {
              await saveEdit(editTarget, values)
              setEditTarget(null)
              await reloadEntries()
            } catch (err) {
              setError(messageOf(err, t("common.error")))
            }
          }}
        />
      )}

      <DeleteVaultModal
        open={deleteVaultOpen}
        accountPassword={deleteAccountPassword}
        setAccountPassword={setDeleteAccountPassword}
        onClose={() => setDeleteVaultOpen(false)}
        onDeleted={deleteVault}
      />
    </ScreenShell>
  )

  function SetupScreen({ onCreated }: { onCreated: (password: string) => void }) {
    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    async function submit() {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setErr(t("passwords.setup.err.weak"))
        return
      }
      if (password !== confirm) {
        setErr(t("passwords.setup.err.mismatch"))
        return
      }
      setBusy(true)
      setErr(null)
      try {
        await onCreated(password)
      } catch (err) {
        setErr(messageOf(err, t("common.error")))
      } finally {
        setBusy(false)
      }
    }

    return (
      <ScrollView contentContainerStyle={{ padding: tokens.space[4], gap: tokens.space[3], paddingBottom: tokens.space[12] }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: tokens.c.textStrong, fontWeight: "700", fontSize: tokens.size.lg }}>{t("passwords.setup.title")}</Text>
        <Text style={{ color: tokens.c.muted }}>{t("passwords.setup.description")}</Text>
        <View style={{ gap: tokens.space[1] }}>
          <Text style={{ color: tokens.c.muted, fontSize: tokens.size.sm }}>{t("passwords.setup.master")}</Text>
          <TextInput
            placeholder={t("common.none")}
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={setPassword}
            style={inputStyle()}
          />
        </View>
        <View style={{ gap: tokens.space[1] }}>
          <Text style={{ color: tokens.c.muted, fontSize: tokens.size.sm }}>{t("passwords.setup.confirm")}</Text>
          <TextInput
            placeholder={t("common.none")}
            secureTextEntry
            autoCapitalize="none"
            value={confirm}
            onChangeText={setConfirm}
            style={inputStyle()}
          />
        </View>
        <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs }}>{t("passwords.setup.min")}</Text>
        <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs }}>{t("passwords.setup.warning")}</Text>
        {err && <Text accessibilityRole="alert" style={{ color: tokens.c.danger, fontSize: tokens.size.sm }}>{err}</Text>}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit()} style={{ backgroundColor: tokens.c.brand, borderRadius: tokens.radius.md, paddingVertical: tokens.space[3], alignItems: "center", opacity: busy ? 0.6 : 1 }}>
          <Text style={{ color: tokens.c.brandContrast, fontWeight: "700" }}>{busy ? t("passwords.setup.create") : t("passwords.setup.create")}</Text>
        </Pressable>
      </ScrollView>
    )
  }

  function DeleteVaultModal({ open, accountPassword, setAccountPassword, onClose, onDeleted }: {
    open: boolean
    accountPassword: string
    setAccountPassword: (v: string) => void
    onClose: () => void
    onDeleted: () => Promise<void>
  }) {
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    async function confirm() {
      setBusy(true)
      setErr(null)
      try {
        await onDeleted()
      } catch {
        setErr(t("passwords.deleteVault.err"))
      } finally {
        setBusy(false)
      }
    }

    return (
      <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: "rgba(2,6,23,0.4)", justifyContent: "center", padding: tokens.space[4] }}>
          <View style={{ backgroundColor: tokens.c.elevated, borderRadius: tokens.radius.lg, borderWidth: 1, borderColor: tokens.c.border, padding: tokens.space[5], gap: tokens.space[3] }}>
            <Text style={{ color: tokens.c.textStrong, fontWeight: "700" }}>{t("passwords.deleteVault.title")}</Text>
            <Text style={{ color: tokens.c.muted }}>{t("passwords.deleteVault.description")}</Text>
            <View style={{ gap: tokens.space[1] }}>
              <Text style={{ color: tokens.c.muted, fontSize: tokens.size.sm }}>{t("passwords.deleteVault.account")}</Text>
              <TextInput
                placeholder=""
                secureTextEntry
                autoCapitalize="none"
                value={accountPassword}
                onChangeText={setAccountPassword}
                style={inputStyle()}
              />
            </View>
            {err && <Text accessibilityRole="alert" style={{ color: tokens.c.danger, fontSize: tokens.size.sm }}>{err}</Text>}
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: tokens.space[2] }}>
              <Pressable accessibilityRole="button" onPress={onClose} style={{ padding: tokens.space[2] }}>
                <Text style={{ color: tokens.c.muted }}>{t("actions.cancel")}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void confirm()} style={{ backgroundColor: tokens.c.danger, borderRadius: tokens.radius.md, paddingHorizontal: tokens.space[4], paddingVertical: tokens.space[2], opacity: busy ? 0.6 : 1 }}>
                <Text style={{ color: tokens.c.brandContrast, fontWeight: "700" }}>{t("actions.delete")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    )
  }

  function inputStyle() {
    return {
      backgroundColor: tokens.c.surface2,
      borderWidth: 1,
      borderColor: tokens.c.border,
      borderRadius: tokens.radius.md,
      paddingHorizontal: tokens.space[3],
      paddingVertical: tokens.space[2],
      color: tokens.c.text,
      minHeight: 44,
    }
  }
}
