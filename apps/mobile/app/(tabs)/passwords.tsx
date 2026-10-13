import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import * as Clipboard from "expo-clipboard"
import { PASSWORD_CATEGORIES, type PasswordEntry, type PasswordVaultProfile } from "@amanak/shared-types"
import { api } from "../../src/lib/api"
import { b64Decode, b64Encode } from "../../src/lib/vault/bytes"
import { defaultGeneratorOptions, generatePassword } from "../../src/lib/vault/generator"
import {
  decryptPayload,
  encryptPayload,
  type CustomField,
  type PasswordPayload,
} from "../../src/lib/vault/passwordPayload"
import { randomBytes } from "../../src/lib/vault/random"
import { aadFromEntryId, deriveKeyBytes } from "../../src/lib/vault/vault"
import { createVerification, verifyKey } from "../../src/lib/vault/verification"

const AUTO_LOCK_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000
const LOCKOUT_MS = 15 * 60 * 1000

type EntryMeta = {
  title: string
  username: string
  url: string
  category: string
  tags: string[]
}

function errorCode(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: unknown }).code)
  }
  return undefined
}

function messageOf(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message
  }
  return fallback
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((tag) => tag.slice(0, 32))
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

export default function Passwords() {
  const [profile, setProfile] = useState<PasswordVaultProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState<Uint8Array | null>(null)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProfile(await api.getPasswordVaultProfile())
    } catch (err) {
      if (errorCode(err) === "not_found") setProfile(null)
      else setError(messageOf(err, "Could not load your vault."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#38bdf8" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
        <Pressable style={styles.button} onPress={() => void loadProfile()}>
          <Text style={styles.buttonText}>Retry</Text>
        </Pressable>
      </View>
    )
  }

  if (!profile) {
    return (
      <SetupScreen
        onCreated={(created, derivedKey) => {
          setProfile(created)
          setKey(derivedKey)
        }}
      />
    )
  }

  if (!key) {
    return <UnlockScreen profile={profile} onUnlocked={setKey} />
  }

  return (
    <VaultList
      profile={profile}
      vaultKey={key}
      onLock={() => setKey(null)}
      onVaultDeleted={() => {
        setKey(null)
        setProfile(null)
      }}
    />
  )
}

function SetupScreen({
  onCreated,
}: {
  onCreated: (p: PasswordVaultProfile, key: Uint8Array) => void
}) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (password.length < 12) {
      setError("Use at least 12 characters.")
      return
    }
    if (password !== confirm) {
      setError("The passwords do not match.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      await new Promise((resolve) => setTimeout(resolve, 0))
      const salt = randomBytes(32)
      const derivedKey = deriveKeyBytes(password, salt)
      const verification = createVerification(derivedKey, randomBytes(12))
      const created = await api.createPasswordVaultProfile({
        kdf_salt: b64Encode(salt),
        verification_iv: b64Encode(verification.iv),
        verification_ciphertext: b64Encode(verification.ciphertext),
      })
      onCreated(created, derivedKey)
    } catch (err) {
      setError(messageOf(err, "Could not create your vault."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.h1}>Create your password vault</Text>
      <Text style={styles.muted}>
        Your master password is never sent to the server and cannot be reset. Only this device can
        read your passwords.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Master password"
        placeholderTextColor="#64748b"
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm master password"
        placeholderTextColor="#64748b"
        secureTextEntry
        autoCapitalize="none"
        value={confirm}
        onChangeText={setConfirm}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} disabled={busy} onPress={() => void submit()}>
        {busy ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.buttonText}>Create vault</Text>}
      </Pressable>
    </ScrollView>
  )
}

function UnlockScreen({
  profile,
  onUnlocked,
}: {
  profile: PasswordVaultProfile
  onUnlocked: (key: Uint8Array) => void
}) {
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const attemptsRef = useRef(0)
  const firstFailRef = useRef<number | null>(null)
  const lockedUntilRef = useRef(0)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const lockedFor = Math.max(0, lockedUntilRef.current - now)
  const locked = lockedFor > 0

  async function attempt() {
    if (locked) return
    setBusy(true)
    setError(null)
    try {
      await new Promise((resolve) => setTimeout(resolve, 0))
      const salt = b64Decode(profile.kdf_salt)
      const derivedKey = deriveKeyBytes(password, salt, profile.kdf_iterations)
      const ok = verifyKey(
        derivedKey,
        b64Decode(profile.verification_iv),
        b64Decode(profile.verification_ciphertext),
      )
      if (!ok) throw new Error("wrong_password")
      attemptsRef.current = 0
      firstFailRef.current = null
      onUnlocked(derivedKey)
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
        setError(`Wrong password. ${MAX_ATTEMPTS - attemptsRef.current} attempt(s) left.`)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.h1}>Unlock your password vault</Text>
      <Text style={styles.muted}>
        The master password decrypts the vault locally. Nothing is sent to the server.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Master password"
        placeholderTextColor="#64748b"
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />
      {locked ? (
        <Text style={styles.error}>
          Too many failed attempts. Try again in {Math.max(1, Math.ceil(lockedFor / 60_000))} min.
        </Text>
      ) : (
        error && <Text style={styles.error}>{error}</Text>
      )}
      <Pressable style={styles.button} disabled={busy || locked} onPress={() => void attempt()}>
        {busy ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.buttonText}>Unlock</Text>}
      </Pressable>
    </ScrollView>
  )
}

function VaultList({
  profile,
  vaultKey,
  onLock,
  onVaultDeleted,
}: {
  profile: PasswordVaultProfile
  vaultKey: Uint8Array
  onLock: () => void
  onVaultDeleted: () => void
}) {
  const [entries, setEntries] = useState<PasswordEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<PasswordEntry | null>(null)
  const [revealed, setRevealed] = useState<Record<number, boolean>>({})
  const [deleteVaultOpen, setDeleteVaultOpen] = useState(false)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api
      .listPasswordEntries()
      .then((data) => {
        if (active) setEntries(data)
      })
      .catch((err) => {
        if (active) setError(messageOf(err, "Could not load your passwords."))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [nonce])

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pokeRef = useRef<() => void>(() => {})
  useEffect(() => {
    pokeRef.current = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(onLock, AUTO_LOCK_MS)
    }
    pokeRef.current()
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [onLock])

  const decrypted = useMemo(
    () =>
      entries.map((entry) => {
        try {
          const payload = decryptPayload(
            vaultKey,
            b64Decode(entry.ciphertext),
            b64Decode(entry.iv),
            aadFromEntryId(entry.id),
          )
          return { entry, payload }
        } catch {
          return { entry, payload: null }
        }
      }),
    [entries, vaultKey],
  )

  function confirmDelete(entry: PasswordEntry) {
    Alert.alert("Delete password", `Remove “${entry.title}” from your vault?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void api.deletePasswordEntry(entry.id).then(reload)
        },
      },
    ])
  }

  return (
    <View
      style={styles.container}
      onStartShouldSetResponderCapture={() => {
        pokeRef.current()
        return false
      }}
    >
      <ScrollView
        onScrollBeginDrag={() => pokeRef.current()}
        contentContainerStyle={styles.listContent}
      >
        <View style={styles.headerRow}>
          <Text style={styles.h1}>Passwords</Text>
          <Pressable onPress={onLock}>
            <Text style={styles.link}>Lock</Text>
          </Pressable>
        </View>

        {loading && <ActivityIndicator color="#38bdf8" />}
        {error && <Text style={styles.error}>{error}</Text>}

        {!loading && entries.length === 0 && (
          <Text style={styles.muted}>No passwords yet. Add your first login.</Text>
        )}

        {decrypted.map(({ entry, payload }) => (
          <View key={entry.id} style={styles.card}>
            <Text style={styles.cardTitle}>{entry.title}</Text>
            {!!entry.username && <Text style={styles.muted}>{entry.username}</Text>}
            {!!entry.url && <Text style={styles.muted}>{entry.url}</Text>}
            {!!entry.category && <Text style={styles.badge}>{entry.category}</Text>}
            {payload ? (
              <Text style={styles.secret}>
                {revealed[entry.id] ? payload.password : "••••••••"}
              </Text>
            ) : (
              <Text style={styles.error}>Unable to decrypt this entry.</Text>
            )}
            <View style={styles.cardFooter}>
              {decrypted.find((d) => entry.id === entry.id) && revealed[entry.id] ? (
                <Pressable onPress={() => setRevealed((r) => ({ ...r, [entry.id]: false }))}>
                  <Text style={styles.link}>Hide</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => setRevealed((r) => ({ ...r, [entry.id]: true }))}>
                  <Text style={styles.link}>Show</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => {
                  const payload = decrypted.find((row) => row.entry.id === entry.id)?.payload
                  if (payload) void Clipboard.setStringAsync(payload.password)
                }}
              >
                <Text style={styles.link}>Copy</Text>
              </Pressable>
              <Pressable onPress={() => setEditTarget(entry)}>
                <Text style={styles.link}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => confirmDelete(entry)}>
                <Text style={styles.danger}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <Pressable style={styles.button} onPress={() => setAddOpen(true)}>
          <Text style={styles.buttonText}>Add password</Text>
        </Pressable>
        <Pressable style={styles.dangerButton} onPress={() => setDeleteVaultOpen(true)}>
          <Text style={styles.dangerButtonText}>Delete vault</Text>
        </Pressable>
        <Text style={styles.note}>
          Passwords live encrypted on the server; only this device holds the key. The master password
          is never sent.
        </Text>
      </ScrollView>

      <EntryModal
        visible={addOpen}
        vaultKey={vaultKey}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false)
          reload()
        }}
      />
      {editTarget && (
        <EntryModal
          visible
          vaultKey={vaultKey}
          entry={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null)
            reload()
          }}
        />
      )}
      <DeleteVaultModal
        visible={deleteVaultOpen}
        onClose={() => setDeleteVaultOpen(false)}
        onDeleted={onVaultDeleted}
      />
    </View>
  )
}

function EntryModal({
  visible,
  vaultKey,
  entry,
  onClose,
  onSaved,
}: {
  visible: boolean
  vaultKey: Uint8Array
  entry?: PasswordEntry
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState("")
  const [username, setUsername] = useState("")
  const [url, setUrl] = useState("")
  const [category, setCategory] = useState("")
  const [tags, setTags] = useState("")
  const [password, setPassword] = useState("")
  const [notes, setNotes] = useState("")
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTitle(entry?.title ?? "")
    setUsername(entry?.username ?? "")
    setUrl(entry?.url ?? "")
    setCategory(entry?.category ?? "")
    setTags(entry?.tags.join(", ") ?? "")
    setError(null)
    setPassword("")
    setNotes("")
    setCustomFields([])
    if (entry) {
      try {
        const payload = decryptPayload(
          vaultKey,
          b64Decode(entry.ciphertext),
          b64Decode(entry.iv),
          aadFromEntryId(entry.id),
        )
        setPassword(payload.password)
        setNotes(payload.notes)
        setCustomFields(payload.customFields)
      } catch {
        setError("Could not decrypt this entry.")
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry, visible])

  function updateField(index: number, changes: Partial<CustomField>) {
    setCustomFields((rows) => rows.map((row, i) => (i === index ? { ...row, ...changes } : row)))
  }

  function applyGenerated() {
    setPassword(generatePassword(defaultGeneratorOptions()))
  }

  async function save() {
    if (!title.trim()) {
      setError("A title is required.")
      return
    }
    if (!isValidUrl(url)) {
      setError("Enter a valid URL (or leave it empty).")
      return
    }
    setBusy(true)
    setError(null)
    const meta: EntryMeta = {
      title: title.trim(),
      username: username.trim(),
      url: url.trim(),
      category,
      tags: parseTags(tags),
    }
    const payload: PasswordPayload = {
      password,
      notes,
      customFields: customFields.filter((field) => field.name.trim()),
    }
    try {
      if (entry) {
        const iv = randomBytes(12)
        const ciphertext = encryptPayload(vaultKey, payload, aadFromEntryId(entry.id), iv)
        await api.updatePasswordEntry(entry.id, {
          ...meta,
          ciphertext: b64Encode(ciphertext),
          iv: b64Encode(iv),
        })
      } else {
        const placeholderIv = randomBytes(12)
        const placeholder = encryptPayload(vaultKey, payload, aadFromEntryId(0), placeholderIv)
        const created = await api.createPasswordEntry({
          ...meta,
          ciphertext: b64Encode(placeholder),
          iv: b64Encode(placeholderIv),
        })
        try {
          const iv = randomBytes(12)
          const ciphertext = encryptPayload(vaultKey, payload, aadFromEntryId(created.id), iv)
          await api.updatePasswordEntry(created.id, {
            ciphertext: b64Encode(ciphertext),
            iv: b64Encode(iv),
          })
        } catch (rebindError) {
          await api.deletePasswordEntry(created.id).catch(() => {})
          throw rebindError
        }
      }
      onSaved()
    } catch (err) {
      setError(messageOf(err, "Could not save this password."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <ScrollView contentContainerStyle={styles.modal} keyboardShouldPersistTaps="handled">
          <Text style={styles.h1}>{entry ? "Edit password" : "Add password"}</Text>
          <TextInput
            style={styles.input}
            placeholder="Title"
            placeholderTextColor="#64748b"
            value={title}
            onChangeText={setTitle}
          />
          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={styles.input}
            placeholder="Website URL"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
            value={url}
            onChangeText={setUrl}
          />
          <View style={styles.chips}>
            <Pressable
              style={[styles.chip, category === "" && styles.chipActive]}
              onPress={() => setCategory("")}
            >
              <Text style={styles.chipText}>None</Text>
            </Pressable>
            {PASSWORD_CATEGORIES.map((value) => (
              <Pressable
                key={value}
                style={[styles.chip, category === value && styles.chipActive]}
                onPress={() => setCategory(value)}
              >
                <Text style={styles.chipText}>{value}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Tags (comma separated)"
            placeholderTextColor="#64748b"
            value={tags}
            onChangeText={setTags}
          />
          <View style={styles.rowInput}>
            <TextInput
              style={[styles.input, styles.flex]}
              placeholder="Password"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable style={styles.smallButton} onPress={applyGenerated}>
              <Text style={styles.buttonText}>Generate</Text>
            </Pressable>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Notes"
            placeholderTextColor="#64748b"
            multiline
            value={notes}
            onChangeText={setNotes}
          />

          <Text style={styles.muted}>Custom fields</Text>
          {customFields.map((field, index) => (
            <View key={index} style={styles.rowInput}>
              <TextInput
                style={[styles.input, styles.flex]}
                placeholder="Name"
                placeholderTextColor="#64748b"
                value={field.name}
                onChangeText={(value) => updateField(index, { name: value })}
              />
              <TextInput
                style={[styles.input, styles.flex]}
                placeholder="Value"
                placeholderTextColor="#64748b"
                value={field.value}
                onChangeText={(value) => updateField(index, { value })}
              />
              <Pressable
                onPress={() => setCustomFields((rows) => rows.filter((_, i) => i !== index))}
              >
                <Text style={styles.danger}>×</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={() =>
              setCustomFields((rows) => [...rows, { name: "", value: "", sensitive: false }])
            }
          >
            <Text style={styles.link}>Add custom field</Text>
          </Pressable>

          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.modalActions}>
            <Pressable onPress={onClose}>
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.button} disabled={busy} onPress={() => void save()}>
              {busy ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.buttonText}>{entry ? "Save" : "Add"}</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

function DeleteVaultModal({
  visible,
  onClose,
  onDeleted,
}: {
  visible: boolean
  onClose: () => void
  onDeleted: () => void
}) {
  const [accountPassword, setAccountPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) {
      setAccountPassword("")
      setError(null)
      setBusy(false)
    }
  }, [visible])

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await api.deletePasswordVaultProfile(accountPassword)
      onDeleted()
    } catch {
      setError("That account password is incorrect.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modal}>
          <Text style={styles.h1}>Delete the entire vault?</Text>
          <Text style={styles.muted}>
            Every password is destroyed immediately. This cannot be undone. Confirm with your AMANAK
            account password.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Account password"
            placeholderTextColor="#64748b"
            secureTextEntry
            autoCapitalize="none"
            value={accountPassword}
            onChangeText={setAccountPassword}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.modalActions}>
            <Pressable onPress={onClose}>
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.dangerButton} disabled={busy} onPress={() => void confirm()}>
              {busy ? (
                <ActivityIndicator color="#f87171" />
              ) : (
                <Text style={styles.dangerButtonText}>Delete vault</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  listContent: { padding: 16, gap: 12, paddingBottom: 48 },
  page: { padding: 16, gap: 12, backgroundColor: "#0f172a", flexGrow: 1 },
  centered: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  h1: { color: "#e2e8f0", fontSize: 22, fontWeight: "700" },
  muted: { color: "#94a3b8" },
  note: { color: "#64748b", fontSize: 12, marginTop: 4 },
  input: { backgroundColor: "#1e293b", color: "#e2e8f0", borderRadius: 12, padding: 14 },
  flex: { flex: 1 },
  rowInput: { flexDirection: "row", alignItems: "center", gap: 8 },
  smallButton: { backgroundColor: "#38bdf8", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  button: { backgroundColor: "#38bdf8", borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#0f172a", fontWeight: "700" },
  dangerButton: {
    borderColor: "#7f1d1d",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  dangerButtonText: { color: "#f87171", fontWeight: "700" },
  error: { color: "#f87171" },
  link: { color: "#38bdf8", fontWeight: "600" },
  danger: { color: "#f87171", fontWeight: "600" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  card: { backgroundColor: "#1e293b", borderRadius: 16, padding: 16, gap: 8 },
  cardTitle: { color: "#e2e8f0", fontWeight: "600", fontSize: 16 },
  secret: { color: "#e2e8f0", fontSize: 18, fontWeight: "700", letterSpacing: 1 },
  badge: {
    alignSelf: "flex-start",
    color: "#94a3b8",
    backgroundColor: "#0ea5e922",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
    fontSize: 12,
  },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderColor: "#334155", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { borderColor: "#38bdf8", backgroundColor: "#0ea5e922" },
  chipText: { color: "#94a3b8", fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(2,6,23,0.7)", justifyContent: "center", padding: 16 },
  modal: { backgroundColor: "#0f172a", borderRadius: 20, padding: 16, gap: 12, maxHeight: "90%" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 12 },
})
