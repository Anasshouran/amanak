import { useEffect, useRef, useState } from "react"
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native"
import type { PasswordVaultProfile } from "@amanak/shared-types"
import { useLocale } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"

const MAX_ATTEMPTS = 5
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000
const LOCKOUT_MS = 15 * 60 * 1000

export type VaultLockScreenMobileProps = {
  profile: PasswordVaultProfile
  autoLockNotice?: boolean
  onUnlocked: () => void
  verify: (password: string, profile: PasswordVaultProfile) => Promise<void>
}

/**
 * Vault unlock screen — web `VaultLockScreen` parity rendered mobile.
 *
 * Master password + Unlock, with attempt throttling (5 failures → 15 min
 * lockout) and an optional auto-lock notice. `verify` is supplied by the
 * screen and performs the PBKDF2 derivation against `lib/vault` (untouched).
 */
export function VaultLockScreenMobile({
  profile,
  autoLockNotice = false,
  onUnlocked,
  verify,
}: VaultLockScreenMobileProps) {
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

  async function attempt() {
    if (locked) return
    setBusy(true)
    setError(null)
    try {
      await verify(password, profile)
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

  useEffect(() => {
    if (password) setError(null)
  }, [password])

  const align: "left" | "right" = isRTL ? "right" : "left"

  return (
    <ScrollView
      contentContainerStyle={{
        padding: tokens.space[4],
        gap: tokens.space[3],
        paddingBottom: tokens.space[12],
        alignItems: "center",
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ gap: tokens.space[3], alignItems: "center" }}>
        <Text style={{ color: tokens.c.textStrong, fontWeight: "700", fontSize: tokens.size.lg, textAlign: align }}>
          {t("vault.locked.title")}
        </Text>
        <Text style={{ color: tokens.c.muted, textAlign: align }}>{t("passwords.unlock.description")}</Text>
        {autoLockNotice && (
          <Text style={{ color: tokens.c.warning, textAlign: align }}>{t("vault.autoLocked")}</Text>
        )}
      </View>

      <View style={{ gap: tokens.space[2], width: "100%" }}>
        <TextInput
          placeholder={t("passwords.unlock.label")}
          placeholderTextColor={tokens.c.muted}
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
          style={{
            backgroundColor: tokens.c.surface2,
            borderWidth: 1,
            borderColor: tokens.c.border,
            borderRadius: tokens.radius.md,
            paddingHorizontal: tokens.space[3],
            paddingVertical: tokens.space[2],
            color: tokens.c.text,
            textAlign: align,
            writingDirection: "ltr",
            width: "100%",
          }}
        />
        {locked ? (
          <Text accessibilityRole="alert" style={{ color: tokens.c.danger, textAlign: align }}>
            {t("passwords.unlock.err.locked", { minutes: Math.max(1, Math.ceil(lockedFor / 60_000)) })}
          </Text>
        ) : (
          error && <Text accessibilityRole="alert" style={{ color: tokens.c.danger, textAlign: align }}>{error}</Text>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={busy || locked}
        onPress={() => void attempt()}
        style={{
          backgroundColor: tokens.c.brand,
          borderRadius: tokens.radius.md,
          paddingVertical: tokens.space[3],
          alignItems: "center",
          opacity: busy || locked ? 0.6 : 1,
          width: "100%",
        }}
      >
        <Text
          style={{
            color: tokens.c.brandContrast,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {busy ? t("passwords.unlock.working") : t("vault.unlock")}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          Alert.alert(t("vault.forgot_password"), t("passwords.setup.warning"), [
            { text: t("actions.cancel"), style: "cancel" },
          ])
        }}
        style={{ paddingVertical: tokens.space[2] }}
      >
        <Text style={{ color: tokens.c.muted, textAlign: align }}>{t("vault.forgot_password")}</Text>
      </Pressable>
    </ScrollView>
  )
}
