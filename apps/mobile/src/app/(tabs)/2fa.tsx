import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { CameraView, useCameraPermissions } from "expo-camera"
import type { TwoFactorEntry, TwoFactorProfile } from "@amanak/shared-types"
import { Header } from "../../components/Header"
import { TwoFactorListMobile } from "../../components/twofa/TwoFactorListMobile"
import { useLocale } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"
import { api } from "../../lib/api"
import { decode as base32Decode } from "../../lib/vault/base32"
import { b64Decode, b64Encode } from "../../lib/vault/bytes"
import { randomBytes } from "../../lib/vault/random"
import {
  aadFromEntryId,
  decryptWithIv,
  deriveKeyBytes,
  encryptWithIv,
} from "../../lib/vault/vault"

const MAX_ATTEMPTS = 5
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000
const LOCKOUT_MS = 15 * 60 * 1000
const MIN_PASSWORD_LENGTH = 12

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

/** Shared page shell: header + padded scroll area, matching the P17.6a screens. */
function ScreenShell({ title, children }: { title: string; children: ReactNode }) {
  const tokens = useTokens()
  return (
    <View style={{ flex: 1, backgroundColor: tokens.c.bg }}>
      <Header title={title} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: tokens.space[4],
          paddingBottom: tokens.space[12],
          gap: tokens.space[4],
        }}
      >
        {children}
      </ScrollView>
    </View>
  )
}

/**
 * 2FA manager — P17.6b parity with the web P17.4a redesign.
 *
 * Unchanged state machine (P8): no profile → setup wizard, profile but no key →
 * unlock, key held → list. Every secret stays a server-blind blob: the crypto
 * calls below are the same ones this screen has always used (`lib/vault/*` is
 * untouched by this work).
 */
export default function TwoFactor() {
  const tokens = useTokens()
  const { t } = useLocale()

  const [profile, setProfile] = useState<TwoFactorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState<Uint8Array | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<TwoFactorEntry | null>(null)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setProfile(await api.getTwoFactorProfile())
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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.c.bg }}>
        <Header title={t("2fa.title")} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={tokens.c.brand} />
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <ScreenShell title={t("2fa.title")}>
        <Text accessibilityRole="alert" style={{ color: tokens.c.danger }}>
          {error}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void loadProfile()}
          style={{
            borderWidth: 1,
            borderColor: tokens.c.borderStrong,
            borderRadius: tokens.radius.md,
            paddingVertical: tokens.space[3],
            alignItems: "center",
          }}
        >
          <Text style={{ color: tokens.c.text }}>{t("actions.retry")}</Text>
        </Pressable>
      </ScreenShell>
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
    <View style={{ flex: 1, backgroundColor: tokens.c.bg }}>
      <Header title={t("twofa.title")} />
      {notice ? (
        <Text
          accessibilityRole="alert"
          style={{
            color: tokens.c.muted,
            backgroundColor: tokens.c.surface2,
            paddingHorizontal: tokens.space[4],
            paddingVertical: tokens.space[2],
          }}
        >
          {notice}
        </Text>
      ) : null}

      <TwoFactorListMobile
        vaultKey={key}
        refreshToken={refreshToken}
        onLock={lock}
        onAutoLock={() => {
          setNotice(t("2fa.autoLocked"))
          lock()
        }}
        onVaultDeleted={() => {
          setKey(null)
          setProfile(null)
          setNotice(null)
        }}
        onAdd={() => setAddOpen(true)}
        onEdit={setEditTarget}
      />

      <EntryModal
        visible={addOpen}
        vaultKey={key}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false)
          setRefreshToken((token) => token + 1)
        }}
      />
      {editTarget ? (
        <EntryModal
          visible
          vaultKey={key}
          entry={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null)
            setRefreshToken((token) => token + 1)
          }}
        />
      ) : null}
    </View>
  )
}

function SetupScreen({
  onCreated,
}: {
  onCreated: (profile: TwoFactorProfile, key: Uint8Array) => void
}) {
  const tokens = useTokens()
  const { t, isRTL } = useLocale()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const align = isRTL ? "right" : "left"
  const strong = password.length >= MIN_PASSWORD_LENGTH
  const input = {
    backgroundColor: tokens.c.surface2,
    borderWidth: 1,
    borderColor: tokens.c.border,
    borderRadius: tokens.radius.md,
    padding: tokens.space[3],
    color: tokens.c.text,
    textAlign: align,
  } as const
  const styles = {
    h1: { color: tokens.c.textStrong, fontSize: tokens.size.xl, fontWeight: "700", textAlign: align },
    desc: { color: tokens.c.muted, fontSize: tokens.size.sm, textAlign: align },
    hint: { color: strong ? tokens.c.success : tokens.c.warning, fontSize: tokens.size["2xs"], textAlign: align },
    warn: { color: tokens.c.warning, fontSize: tokens.size.sm, textAlign: align, writingDirection: isRTL ? "rtl" : "ltr" as const },
    err: { color: tokens.c.danger, textAlign: align },
    primary: { backgroundColor: tokens.c.brand, borderRadius: tokens.radius.md, paddingVertical: tokens.space[4], alignItems: "center", opacity: busy ? 0.6 : 1 },
  } as const

  async function submit() {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("2fa.setup.err.weak"))
      return
    }
    if (password !== confirm) {
      setError(t("2fa.setup.err.mismatch"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await new Promise((resolve) => setTimeout(resolve, 0))
      const salt = randomBytes(32)
      const created = await api.createTwoFactorProfile({ kdf_salt: b64Encode(salt) })
      onCreated(created, deriveKeyBytes(password, b64Decode(created.kdf_salt), created.kdf_iterations))
    } catch (err) {
      setError(messageOf(err, t("2fa.setup.err.create")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenShell title={t("2fa.title")}>
      <Text style={styles.h1}>{t("2fa.setup.title")}</Text>
      <Text style={styles.desc}>{t("2fa.setup.description")}</Text>

      <TextInput
        accessibilityLabel={t("2fa.setup.master")}
        style={input}
        placeholder={t("2fa.setup.master")}
        placeholderTextColor={tokens.c.muted}
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={setPassword}
      />
      {password.length > 0 ? (
        <Text style={styles.hint}>
          {strong ? t("2fa.setup.strong") : t("2fa.setup.min")}
        </Text>
      ) : null}

      <TextInput
        accessibilityLabel={t("2fa.setup.confirm")}
        style={input}
        placeholder={t("2fa.setup.confirm")}
        placeholderTextColor={tokens.c.muted}
        secureTextEntry
        autoCapitalize="none"
        value={confirm}
        onChangeText={setConfirm}
      />

      <Text style={styles.warn}>{t("2fa.setup.warning")}</Text>

      {error ? (
        <Text accessibilityRole="alert" style={styles.err}>{error}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={() => void submit()}
        style={styles.primary}
      >
        {busy ? (
          <ActivityIndicator color={tokens.c.brandContrast} />
        ) : (
          <Text style={{ color: tokens.c.brandContrast, fontWeight: "700" }}>
            {t("2fa.setup.create")}
          </Text>
        )}
      </Pressable>
    </ScreenShell>
  )
}

function UnlockScreen({
  profile,
  onUnlocked,
}: {
  profile: TwoFactorProfile
  onUnlocked: (key: Uint8Array) => void
}) {
  const tokens = useTokens()
  const { t, isRTL } = useLocale()
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
  const align = isRTL ? "right" : "left"

  async function attempt() {
    if (locked || busy) return
    setBusy(true)
    setError(null)
    try {
      await new Promise((resolve) => setTimeout(resolve, 0))
      const salt = b64Decode(profile.kdf_salt)
      const derivedKey = deriveKeyBytes(password, salt, profile.kdf_iterations)
      const entries = await api.listTwoFactorEntries()
      if (entries.length > 0) {
        decryptWithIv(
          derivedKey,
          b64Decode(entries[0].ciphertext),
          b64Decode(entries[0].iv),
          aadFromEntryId(entries[0].id),
        )
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
        setError(null)
      } else {
        setError(t("2fa.unlock.err.wrong", { attempts: MAX_ATTEMPTS - attemptsRef.current }))
      }
    } finally {
      setBusy(false)
    }
  }

  const S = {
    h1: { color: tokens.c.textStrong, fontSize: tokens.size.xl, fontWeight: "700", textAlign: align },
    desc: { color: tokens.c.muted, textAlign: align },
    input: { backgroundColor: tokens.c.surface2, borderWidth: 1, borderColor: tokens.c.border, borderRadius: tokens.radius.md, padding: tokens.space[3], color: tokens.c.text, textAlign: align },
    err: { color: tokens.c.danger, textAlign: align },
    primary: { backgroundColor: tokens.c.brand, borderRadius: tokens.radius.md, paddingVertical: tokens.space[4], alignItems: "center", opacity: busy || locked ? 0.6 : 1 },
  } as const

  return (
    <ScreenShell title={t("2fa.title")}>
      <Text style={S.h1}>{t("2fa.unlock.title")}</Text>
      <Text style={S.desc}>{t("2fa.unlock.description")}</Text>

      <TextInput
        accessibilityLabel={t("2fa.setup.master")}
        style={S.input}
        placeholder={t("2fa.setup.master")}
        placeholderTextColor={tokens.c.muted}
        secureTextEntry
        autoCapitalize="none"
        value={password}
        onChangeText={(value) => {
          setPassword(value)
          setError(null)
        }}
      />

      {locked ? (
        <Text accessibilityRole="alert" style={S.err}>
          {t("2fa.unlock.err.locked", { minutes: Math.max(1, Math.ceil(lockedFor / 60000)) })}
        </Text>
      ) : error ? (
        <Text accessibilityRole="alert" style={S.err}>
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy || locked, busy }}
        disabled={busy || locked}
        onPress={() => void attempt()}
        style={S.primary}
      >
        {busy ? (
          <ActivityIndicator color={tokens.c.brandContrast} />
        ) : (
          <Text style={{ color: tokens.c.brandContrast, fontWeight: "700" }}>
            {t("2fa.unlock.action")}
          </Text>
        )}
      </Pressable>
    </ScreenShell>
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
  const tokens = useTokens()
  const { t, isRTL } = useLocale()
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

  const align: "right" | "left" = isRTL ? "right" : "left"
  const field = {
    backgroundColor: tokens.c.surface2,
    borderWidth: 1,
    borderColor: tokens.c.border,
    borderRadius: tokens.radius.md,
    padding: tokens.space[3],
    color: tokens.c.text,
    textAlign: align,
  } as const
  // Shared shapes for the modal shell, action row and primary button.
  const S = {
    panel: {
      backgroundColor: tokens.c.elevated,
      borderRadius: tokens.radius.lg,
      borderWidth: 1,
      borderColor: tokens.c.border,
      padding: tokens.space[5],
      gap: tokens.space[3],
    },
    title: { color: tokens.c.textStrong, fontSize: tokens.size.lg, fontWeight: "700" as const, textAlign: align },
    err: { color: tokens.c.danger, textAlign: align },
    actions: {
      flexDirection: isRTL ? ("row-reverse" as const) : ("row" as const),
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      gap: tokens.space[3],
    },
    primary: {
      backgroundColor: tokens.c.brand,
      borderRadius: tokens.radius.md,
      paddingHorizontal: tokens.space[5],
      paddingVertical: tokens.space[3],
      opacity: busy ? 0.6 : 1,
    },
    primaryLabel: { color: tokens.c.brandContrast, fontWeight: "700" as const },
    tablist: {
      flexDirection: isRTL ? ("row-reverse" as const) : ("row" as const),
      backgroundColor: tokens.c.surface2,
      borderRadius: tokens.radius.full,
      padding: 4,
      gap: 4,
    },
  }

  async function save() {
    if (!label.trim()) {
      setError(t("2fa.add.err.label"))
      return
    }

    setBusy(true)
    setError(null)
    try {
      if (entry) {
        // Editing without retyping the setup key only renames the entry — the
        // ciphertext is left exactly as it is.
        const trimmed = secret.replace(/\s+/g, "")
        if (!trimmed) {
          await api.updateTwoFactorEntry(entry.id, {
            label: label.trim(),
            issuer: issuer.trim(),
          })
          onSaved()
          return
        }
        const secretBytes = decodeSecret(trimmed, setError, t)
        if (!secretBytes) return
        const iv = randomBytes(12)
        const ciphertext = encryptWithIv(vaultKey, secretBytes, aadFromEntryId(entry.id), iv)
        await api.updateTwoFactorEntry(entry.id, {
          label: label.trim(),
          issuer: issuer.trim(),
          ciphertext: b64Encode(ciphertext),
          iv: b64Encode(iv),
        })
      } else {
        const secretBytes = decodeSecret(secret.replace(/\s+/g, ""), setError, t)
        if (!secretBytes) return
        // The entry id becomes part of the AAD, so create first with a
        // throwaway binding, then rebind the ciphertext to the real id.
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
          await api.updateTwoFactorEntry(created.id, {
            ciphertext: b64Encode(ciphertext),
            iv: b64Encode(iv),
          })
        } catch (rebindError) {
          await api.deleteTwoFactorEntry(created.id).catch(() => {})
          throw rebindError
        }
      }
      onSaved()
    } catch (err) {
      setError(messageOf(err, t("2fa.add.err.create")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: tokens.c.overlay }]}>
        <View style={S.panel}>
          <Text style={S.title}>{entry ? t("2fa.edit.title") : t("2fa.add.title")}</Text>

          <View style={S.tablist}>
            {(["manual", "scan"] as const).map((value) => {
              const selected = value === mode
              return (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  onPress={() => setMode(value)}
                  style={{
                    flex: 1,
                    paddingVertical: tokens.space[2],
                    borderRadius: tokens.radius.full,
                    alignItems: "center",
                    backgroundColor: selected ? tokens.c.surface : "transparent",
                  }}
                >
                  <Text style={{ color: selected ? tokens.c.textStrong : tokens.c.muted, fontWeight: "600" }}>
                    {value === "manual" ? t("2fa.add.manual") : t("2fa.add.scan")}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          {mode === "scan" ? (
            <ScanView
              hint={t("2fa.add.scanHint")}
              permission={permission}
              requestPermission={requestPermission}
              onScanned={(uri) => {
                const parsed = parseOtpauth(uri)
                if (!parsed) {
                  setError(t("2fa.add.err.notTotp"))
                  return
                }
                setLabel(parsed.label)
                setIssuer(parsed.issuer ?? "")
                setSecret(parsed.secret)
                setMode("manual")
                setError(null)
              }}
              allowLabel={t("2fa.add.allowCamera")}
            />
          ) : null}

          <TextInput
            style={field}
            placeholder={t("2fa.add.label")}
            placeholderTextColor={tokens.c.muted}
            value={label}
            onChangeText={setLabel}
          />
          <TextInput
            style={field}
            placeholder={t("2fa.add.issuer")}
            placeholderTextColor={tokens.c.muted}
            value={issuer}
            onChangeText={setIssuer}
          />
          <TextInput
            placeholder={t("2fa.add.secret")}
            placeholderTextColor={tokens.c.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            value={secret}
            onChangeText={setSecret}
            // Always LTR so a base32 key is never reordered in an Arabic layout.
            style={{ ...field, textAlign: "left", writingDirection: "ltr" }}
          />

          {error ? (
            <Text accessibilityRole="alert" style={S.err}>
              {error}
            </Text>
          ) : null}

          <View style={S.actions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={{ paddingVertical: tokens.space[2] }}>
              <Text style={{ color: tokens.c.muted }}>{t("actions.cancel")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: busy, busy }}
              disabled={busy}
              onPress={() => void save()}
              style={S.primary}
            >
              {busy ? (
                <ActivityIndicator color={tokens.c.brandContrast} />
              ) : (
                <Text style={S.primaryLabel}>{entry ? t("actions.save") : t("2fa.add.save")}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

/** Base32 → bytes, reporting a localised error instead of throwing. */
function decodeSecret(
  value: string,
  setError: (message: string) => void,
  t: (key: string) => string,
): Uint8Array | null {
  let bytes: Uint8Array
  try {
    bytes = base32Decode(value)
  } catch {
    setError(t("2fa.add.err.invalid"))
    return null
  }
  if (bytes.length === 0) {
    setError(t("2fa.add.err.invalid"))
    return null
  }
  return bytes
}

function ScanView({
  hint,
  permission,
  requestPermission,
  onScanned,
  allowLabel,
}: {
  hint: string
  permission: ReturnType<typeof useCameraPermissions>[0]
  requestPermission: () => Promise<unknown>
  onScanned: (data: string) => void
  allowLabel: string
}) {
  const tokens = useTokens()
  const { isRTL } = useLocale()
  const handledRef = useRef(false)

  if (!permission) return <ActivityIndicator color={tokens.c.brand} />

  if (!permission.granted) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => void requestPermission()}
        style={{
          backgroundColor: tokens.c.brand,
          borderRadius: tokens.radius.md,
          paddingVertical: tokens.space[3],
          alignItems: "center",
        }}
      >
        <Text style={{ color: tokens.c.brandContrast, fontWeight: "700" }}>{allowLabel}</Text>
      </Pressable>
    )
  }

  return (
    <View style={{ gap: tokens.space[2] }}>
      <Text style={{ color: tokens.c.muted, fontSize: tokens.size.sm, textAlign: isRTL ? "right" : "left" }}>
        {hint}
      </Text>
      <View style={{ height: 220, borderRadius: tokens.radius.md, overflow: "hidden", backgroundColor: "#020617" }}>
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
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
})
