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
import { CameraView, useCameraPermissions } from "expo-camera"
import * as Clipboard from "expo-clipboard"
import { api } from "../../src/lib/api"
import type { TwoFactorEntry, TwoFactorProfile } from "@amanak/shared-types"
import { b64Decode, b64Encode } from "../../src/lib/vault/bytes"
import { decode as base32Decode } from "../../src/lib/vault/base32"
import { generateTotp, totpSecondsRemaining } from "../../src/lib/vault/totp"
import {
  aadFromEntryId,
  decryptWithIv,
  deriveKeyBytes,
  encryptWithIv,
} from "../../src/lib/vault/vault"
import { randomBytes } from "../../src/lib/vault/random"

const AUTO_LOCK_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000
const LOCKOUT_MS = 15 * 60 * 1000

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

export default function Vault() {
  const [profile, setProfile] = useState<TwoFactorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState<Uint8Array | null>(null)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProfile(await api.getTwoFactorProfile())
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

  const lock = useCallback(() => setKey(null), [])

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
      onLock={lock}
      onVaultDeleted={() => {
        setKey(null)
        setProfile(null)
      }}
    />
  )
}

function SetupScreen({ onCreated }: { onCreated: (p: TwoFactorProfile, key: Uint8Array) => void }) {
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
      const created = await api.createTwoFactorProfile({ kdf_salt: b64Encode(salt) })
      const derivedKey = deriveKeyBytes(password, salt, created.kdf_iterations)
      onCreated(created, derivedKey)
    } catch (err) {
      setError(messageOf(err, "Could not create your vault."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.h1}>Create your vault</Text>
      <Text style={styles.muted}>
        Your master password is never sent to the server and cannot be reset. Only this device can
        read your codes.
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
  profile: TwoFactorProfile
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
      const entries = await api.listTwoFactorEntries()
      if (entries.length > 0) {
        decryptWithIv(derivedKey, b64Decode(entries[0].ciphertext), b64Decode(entries[0].iv), aadFromEntryId(entries[0].id))
      }
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
      <Text style={styles.h1}>Unlock your vault</Text>
      <Text style={styles.muted}>Enter your master password to decrypt your codes on this device.</Text>
      <TextInput
        style={styles.input}
        placeholder="Master password"
        placeholderTextColor="#64748b"
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={(value) => {
          setPassword(value)
          setError(null)
        }}
      />
      {locked ? (
        <Text style={styles.error}>Too many attempts. Try again in {Math.max(1, Math.ceil(lockedFor / 60000))} min.</Text>
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
  profile: TwoFactorProfile
  vaultKey: Uint8Array
  onLock: () => void
  onVaultDeleted: () => void
}) {
  const [entries, setEntries] = useState<TwoFactorEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TwoFactorEntry | null>(null)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    api
      .listTwoFactorEntries()
      .then((data) => {
        if (active) setEntries(data)
      })
      .catch((err) => {
        if (active) setError(messageOf(err, "Could not load your entries."))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [nonce])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

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
          const secret = decryptWithIv(vaultKey, b64Decode(entry.ciphertext), b64Decode(entry.iv), aadFromEntryId(entry.id))
          return { entry, secret, code: generateTotp(secret, now) }
        } catch {
          return { entry, secret: null, code: null }
        }
      }),
    [entries, vaultKey, now],
  )

  function confirmDelete(entry: TwoFactorEntry) {
    Alert.alert("Delete entry", `Remove “${entry.label}” from your vault?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void api.deleteTwoFactorEntry(entry.id).then(reload)
        },
      },
    ])
  }

  function confirmDeleteVault() {
    Alert.alert("Delete entire vault", "This permanently removes your vault and every code in it.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete vault",
        style: "destructive",
        onPress: () => {
          void api.deleteTwoFactorProfile().then(onVaultDeleted)
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
      <ScrollView onScrollBeginDrag={() => pokeRef.current()} contentContainerStyle={styles.listContent}>
        <View style={styles.headerRow}>
          <Text style={styles.h1}>2FA Vault</Text>
          <Pressable onPress={onLock}>
            <Text style={styles.link}>Lock</Text>
          </Pressable>
        </View>

        {loading && <ActivityIndicator color="#38bdf8" />}
        {error && <Text style={styles.error}>{error}</Text>}

        {!loading && entries.length === 0 && (
          <Text style={styles.muted}>No 2FA entries yet. Add one to start generating codes.</Text>
        )}

        {decrypted.map(({ entry, code }) => (
          <View key={entry.id} style={styles.card}>
            <Text style={styles.cardTitle}>{entry.issuer ? `${entry.issuer} · ${entry.label}` : entry.label}</Text>
            {code ? (
              <Text style={styles.code}>{code.slice(0, 3)} {code.slice(3)}</Text>
            ) : (
              <Text style={styles.error}>Unable to decrypt this entry.</Text>
            )}
            <View style={styles.cardFooter}>
              <Text style={styles.muted}>{totpSecondsRemaining(now)}s</Text>
              {code && (
                <Pressable onPress={() => void Clipboard.setStringAsync(code)}>
                  <Text style={styles.link}>Copy</Text>
                </Pressable>
              )}
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
          <Text style={styles.buttonText}>Add entry</Text>
        </Pressable>
        <Pressable style={styles.dangerButton} onPress={confirmDeleteVault}>
          <Text style={styles.dangerButtonText}>Delete vault</Text>
        </Pressable>
        <Text style={styles.note}>Codes live only in memory. The server never sees your master password or secrets.</Text>
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
    </View>
  )
}

type ParsedOtpauth = { label: string; issuer?: string; secret: string }

function parseOtpauth(uri: string): ParsedOtpauth | null {
  if (!uri.toLowerCase().startsWith("otpauth://")) return null
  const questionMark = uri.indexOf("?")
  if (questionMark < 0) return null
  const path = uri.slice(0, questionMark)
  const params = new URLSearchParams(uri.slice(questionMark + 1))
  const secret = (params.get("secret") ?? "").trim()
  if (!secret) return null
  const rawLabel = decodeURIComponent(path.split("/").slice(3).join("/"))
  let label = rawLabel
  let issuer = params.get("issuer") ?? undefined
  if (!issuer && label.includes(":")) {
    const [prefix, ...rest] = label.split(":")
    issuer = prefix.trim()
    label = rest.join(":")
  }
  if (!label.trim()) return null
  return { label: label.trim(), issuer, secret }
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
  entry?: TwoFactorEntry
  onClose: () => void
  onSaved: () => void
}) {
  const [label, setLabel] = useState("")
  const [issuer, setIssuer] = useState("")
  const [secret, setSecret] = useState("")
  const [mode, setMode] = useState<"manual" | "scan">("manual")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permission, requestPermission] = useCameraPermissions()

  useEffect(() => {
    setLabel(entry?.label ?? "")
    setIssuer(entry?.issuer ?? "")
    setSecret("")
    setMode("manual")
    setError(null)
  }, [entry, visible])

  async function save() {
    if (!label.trim()) {
      setError("Give this entry a label.")
      return
    }
    let secretBytes: Uint8Array
    try {
      secretBytes = base32Decode(secret.replace(/\s+/g, ""))
    } catch {
      setError("That secret is not valid base32.")
      return
    }
    if (secretBytes.length === 0) {
      setError("Enter the setup key.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (entry) {
        const aad = aadFromEntryId(entry.id)
        const iv = randomBytes(12)
        const ciphertext = encryptWithIv(vaultKey, secretBytes, aad, iv)
        await api.updateTwoFactorEntry(entry.id, {
          label: label.trim(),
          issuer: issuer.trim(),
          ciphertext: b64Encode(ciphertext),
          iv: b64Encode(iv),
        })
      } else {
        const placeholderIv = randomBytes(12)
        const placeholder = encryptWithIv(vaultKey, secretBytes, aadFromEntryId(0), placeholderIv)
        const created = await api.createTwoFactorEntry({
          label: label.trim(),
          issuer: issuer.trim(),
          ciphertext: b64Encode(placeholder),
          iv: b64Encode(placeholderIv),
        })
        try {
          const iv = randomBytes(12)
          const ciphertext = encryptWithIv(vaultKey, secretBytes, aadFromEntryId(created.id), iv)
          await api.updateTwoFactorEntry(created.id, { ciphertext: b64Encode(ciphertext), iv: b64Encode(iv) })
        } catch (rebindError) {
          await api.deleteTwoFactorEntry(created.id).catch(() => {})
          throw rebindError
        }
      }
      onSaved()
    } catch (err) {
      setError(messageOf(err, "Could not save this entry."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modal}>
          <Text style={styles.h1}>{entry ? "Edit entry" : "Add entry"}</Text>
          <View style={styles.segment}>
            <Pressable style={[styles.segmentItem, mode === "manual" && styles.segmentActive]} onPress={() => setMode("manual")}>
              <Text style={styles.segmentText}>Enter key</Text>
            </Pressable>
            <Pressable style={[styles.segmentItem, mode === "scan" && styles.segmentActive]} onPress={() => setMode("scan")}>
              <Text style={styles.segmentText}>Scan QR</Text>
            </Pressable>
          </View>

          {mode === "scan" && (
            <ScanView
              permission={permission}
              requestPermission={requestPermission}
              onScanned={(uri) => {
                const parsed = parseOtpauth(uri)
                if (!parsed) {
                  setError("That QR code is not an authenticator setup code.")
                  return
                }
                setLabel(parsed.label)
                setIssuer(parsed.issuer ?? "")
                setSecret(parsed.secret)
                setMode("manual")
              }}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Label (e.g. you@example.com)"
            placeholderTextColor="#64748b"
            value={label}
            onChangeText={setLabel}
          />
          <TextInput
            style={styles.input}
            placeholder="Issuer (optional)"
            placeholderTextColor="#64748b"
            value={issuer}
            onChangeText={setIssuer}
          />
          <TextInput
            style={styles.input}
            placeholder="Setup key (base32)"
            placeholderTextColor="#64748b"
            autoCapitalize="characters"
            autoCorrect={false}
            value={secret}
            onChangeText={setSecret}
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.modalActions}>
            <Pressable onPress={onClose}>
              <Text style={styles.link}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.button} disabled={busy} onPress={() => void save()}>
              {busy ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.buttonText}>{entry ? "Save" : "Add"}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

function ScanView({
  permission,
  requestPermission,
  onScanned,
}: {
  permission: ReturnType<typeof useCameraPermissions>[0]
  requestPermission: () => Promise<unknown>
  onScanned: (data: string) => void
}) {
  const handledRef = useRef(false)
  if (!permission) return <ActivityIndicator color="#38bdf8" />
  if (!permission.granted) {
    return (
      <Pressable style={styles.button} onPress={() => void requestPermission()}>
        <Text style={styles.buttonText}>Allow camera</Text>
      </Pressable>
    )
  }
  return (
    <View style={styles.scanner}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => {
          if (handledRef.current) return
          handledRef.current = true
          onScanned(data)
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  listContent: { padding: 16, gap: 12, paddingBottom: 48 },
  page: { padding: 16, gap: 12, backgroundColor: "#0f172a", flexGrow: 1 },
  centered: { flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  h1: { color: "#e2e8f0", fontSize: 22, fontWeight: "700" },
  muted: { color: "#94a3b8" },
  note: { color: "#64748b", fontSize: 12, marginTop: 4 },
  input: { backgroundColor: "#1e293b", color: "#e2e8f0", borderRadius: 12, padding: 14 },
  button: { backgroundColor: "#38bdf8", borderRadius: 12, padding: 14, alignItems: "center" },
  buttonText: { color: "#0f172a", fontWeight: "700" },
  dangerButton: { borderColor: "#7f1d1d", borderWidth: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  dangerButtonText: { color: "#f87171", fontWeight: "700" },
  error: { color: "#f87171" },
  link: { color: "#38bdf8", fontWeight: "600" },
  danger: { color: "#f87171", fontWeight: "600" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  card: { backgroundColor: "#1e293b", borderRadius: 16, padding: 16, gap: 8 },
  cardTitle: { color: "#e2e8f0", fontWeight: "600" },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  code: { color: "#e2e8f0", fontSize: 34, fontWeight: "700", letterSpacing: 4, fontVariant: ["tabular-nums"] },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(2,6,23,0.7)", justifyContent: "center", padding: 16 },
  modal: { backgroundColor: "#0f172a", borderRadius: 20, padding: 16, gap: 12, maxHeight: "90%" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 16, marginTop: 4 },
  segment: { flexDirection: "row", backgroundColor: "#1e293b", borderRadius: 12, padding: 4, gap: 4 },
  segmentItem: { flex: 1, padding: 10, borderRadius: 8, alignItems: "center" },
  segmentActive: { backgroundColor: "#334155" },
  segmentText: { color: "#e2e8f0", fontWeight: "600" },
  scanner: { height: 220, borderRadius: 12, overflow: "hidden", backgroundColor: "#020617" },
})