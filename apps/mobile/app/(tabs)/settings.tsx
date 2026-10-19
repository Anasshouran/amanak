import { useEffect, useState } from "react"
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native"
import { Header } from "../../src/components/Header"
import { SettingsSection } from "../../src/components/settings/SettingsSection"
import { SettingsRow } from "../../src/components/settings/SettingsRow"
import { SettingsNotifications } from "../../src/components/settings/SettingsNotifications"
import { SettingsPrivacy } from "../../src/components/settings/SettingsPrivacy"
import { ThemePicker } from "../../src/components/settings/ThemePicker"
import { LocalePicker } from "../../src/components/settings/LocalePicker"
import { useRouter } from "expo-router"
import { useAuth } from "../../src/state/AuthContext"
import { api } from "../../src/lib/api"
import { useLocale } from "../../src/design/LocaleProvider"
import { useTokens } from "../../src/design/tokens"

type User = {
  id: number
  email: string
  username?: string
  display_name?: string
  created_at?: string
}

type SaveStatus = "idle" | "saving" | "saved" | "error"

/**
 * Settings screen — device preferences, profile and account actions.
 *
 * P17.7b wires the three previously-missing endpoints: an editable display
 * name (`PATCH /me/`), notification preferences
 * (`/notifications/preferences/`) and the self-service data download
 * (`POST /me/export/`).
 */
export default function Settings() {
  const tokens = useTokens()
  const { t, isRTL } = useLocale()
  const { user, logout } = useAuth()
  const router = useRouter()

  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState("")
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")

  useEffect(() => {
    let active = true
    api
      .me()
      .then((data) => {
        if (!active) return
        setProfile(data as User)
        setDisplayName(data.display_name ?? data.username ?? "")
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function saveDisplayName() {
    setSaveStatus("saving")
    try {
      const updated = await api.updateProfile({ display_name: displayName.trim() })
      setProfile((prev) => ({ ...(prev as User), ...updated }))
      setDisplayName(updated.display_name ?? updated.username ?? "")
      setSaveStatus("saved")
    } catch {
      setSaveStatus("error")
    }
  }

  async function signOut() {
    await Alert.alert(
      t("settings.signout.confirm_title"),
      t("settings.signout.confirm_body"),
      [
        { text: t("actions.cancel"), style: "cancel" },
        { text: t("settings.signout"), style: "destructive", onPress: () => void logout() },
      ],
    )
    await logout()
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.c.bg }}>
        <Text style={{ color: tokens.c.muted }}>{t("common.loading")}</Text>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={{ padding: tokens.space[4], gap: tokens.space[4], paddingBottom: tokens.space[16] }} keyboardShouldPersistTaps="handled">
      <Header title={t("settings.title")} />
      <Text style={{ color: tokens.c.muted }}>{t("settings.subtitle")}</Text>

      <SettingsSection label={t("settings.section.profile")}>
        <View style={{ gap: tokens.space[2] }}>
          <Text style={{ color: tokens.c.muted, fontSize: tokens.size.sm }}>{t("settings.profile.name")}</Text>
          <TextInput
            accessibilityLabel={t("settings.profile.name")}
            value={displayName}
            onChangeText={(value) => {
              setDisplayName(value)
              setSaveStatus("idle")
            }}
            autoCapitalize="words"
            maxLength={100}
            style={{
              borderWidth: 1,
              borderColor: tokens.c.border,
              borderRadius: tokens.radius.md,
              paddingHorizontal: tokens.space[3],
              paddingVertical: tokens.space[2],
              color: tokens.c.text,
            }}
          />
          <Pressable
            accessibilityRole="button"
            disabled={saveStatus === "saving"}
            onPress={() => void saveDisplayName()}
            style={{
              alignSelf: "flex-start",
              paddingVertical: tokens.space[2],
              paddingHorizontal: tokens.space[4],
              borderWidth: 1,
              borderColor: tokens.c.border,
              borderRadius: tokens.radius.md,
              opacity: saveStatus === "saving" ? 0.5 : 1,
            }}
          >
            <Text style={{ color: tokens.c.text, fontWeight: "600" }}>
              {saveStatus === "saving" ? t("common.loading") : t("actions.save")}
            </Text>
          </Pressable>
          {saveStatus === "saved" ? (
            <Text style={{ color: tokens.c.muted }}>{t("settings.profile.saved")}</Text>
          ) : null}
          {saveStatus === "error" ? (
            <Text style={{ color: tokens.c.danger }}>{t("settings.profile.save_error")}</Text>
          ) : null}
        </View>
        <SettingsRow label={t("settings.profile.email")} value={profile?.email ?? t("common.none")} disabled />
        <SettingsRow
          label={t("settings.profile.joined")}
          value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : t("common.none")}
          disabled
        />
      </SettingsSection>

      <SettingsSection label={t("settings.section.appearance")}>
        <ThemePicker />
        <LocalePicker />
      </SettingsSection>

      <SettingsSection label={t("settings.section.security")}>
        <SettingsRow label={t("settings.security.twofa")} value="" onPress={() => void router.push("/2fa")} />
        <SettingsRow label={t("settings.security.vault")} value="" onPress={() => void router.push("/passwords")} />
        <SettingsRow label={t("settings.security.devices")} value="" onPress={() => void router.push("/devices")} />
      </SettingsSection>

      <SettingsSection label={t("settings.section.notifications")}>
        <SettingsNotifications />
      </SettingsSection>

      <SettingsSection label={t("settings.section.privacy")}>
        <SettingsPrivacy />
      </SettingsSection>

      <SettingsSection label={t("settings.section.about")}>
        <SettingsRow label={t("settings.about.version")} value="1.0.0" disabled />
        <SettingsRow label={t("settings.about.privacy_policy")} value="" onPress={() => {}} />
        <SettingsRow label={t("settings.about.terms")} value="" onPress={() => {}} />
      </SettingsSection>

      <Pressable
        accessibilityRole="button"
        onPress={signOut}
        style={{
          marginHorizontal: tokens.space[4],
          paddingVertical: tokens.space[3],
          borderWidth: 1,
          borderColor: tokens.c.danger,
          borderRadius: tokens.radius.md,
          alignItems: "center",
        }}
      >
        <Text style={{ color: tokens.c.danger, fontWeight: "700", textAlign: "center" }}>{t("settings.signout")}</Text>
      </Pressable>
    </ScrollView>
  )
}
