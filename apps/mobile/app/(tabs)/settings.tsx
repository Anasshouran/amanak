import { useEffect, useState } from "react"
import { Alert, Pressable, ScrollView, Text, View } from "react-native"
import { Header } from "../../src/components/Header"
import { SettingsSection } from "../../src/components/settings/SettingsSection"
import { SettingsRow } from "../../src/components/settings/SettingsRow"
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
  created_at?: string
}

/**
 * Settings screen — device preferences, profile and account actions.
 *
 * Profile display-name editing is read-only here because the backend exposes
 * `GET /me/` only (no `PATCH /me/`); it is shown as disabled with a hint.
 * Notifications / data-download have no user-facing endpoint yet, so they
 * render the "Coming soon" hint per the P17.6c spec.
 */
export default function Settings() {
  const tokens = useTokens()
  const { t, isRTL } = useLocale()
  const { user, logout } = useAuth()
  const router = useRouter()

  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    api
      .me()
      .then((data) => {
        if (active) setProfile(data as User)
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

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
        <SettingsRow label={t("settings.profile.name")} value={profile?.username ?? t("common.none")} disabled />
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
        <SettingsRow label={t("settings.notifications.coming_soon")} disabled />
      </SettingsSection>

      <SettingsSection label={t("settings.section.privacy")}>
        {/* Data download has no user-facing endpoint yet; omitted per P17.6c spec. */}
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
