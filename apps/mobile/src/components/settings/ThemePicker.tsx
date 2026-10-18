import { Pressable, Text, View } from "react-native"
import { useTokens } from "../../design/tokens"
import { useTheme } from "../../design/ThemeProvider"
import { useLocale } from "../../design/LocaleProvider"

type ThemeOption = "light" | "dark" | "system"

const OPTIONS: ThemeOption[] = ["light", "dark", "system"]

/**
 * Theme picker — Light / Dark / System segmented control.
 *
 * Writes the preference through `useTheme().setTheme`; "system" follows the
 * device colour scheme. Persisted across restarts.
 */
export function ThemePicker() {
  const tokens = useTokens()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const { t, isRTL } = useLocale()

  const selected = theme === "system" ? resolvedTheme : theme

  return (
    <View style={{ gap: tokens.space[2], paddingHorizontal: tokens.space[4] }}>
      <Text style={{ color: tokens.c.muted, fontSize: tokens.size.sm, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>
        {t("settings.appearance.theme")}
      </Text>
      <View
        style={{
          backgroundColor: tokens.c.surface2,
          borderWidth: 1,
          borderColor: tokens.c.border,
          borderRadius: tokens.radius.md,
          overflow: "hidden",
          flexDirection: "row",
        }}
      >
        {OPTIONS.map((option) => {
          const active = theme === option
          const label =
            option === "light" ? t("settings.appearance.theme.light") : option === "dark" ? t("settings.appearance.theme.dark") : t("settings.appearance.theme.system")
          return (
            <Pressable key={option} onPress={() => setTheme(option)} style={{ flex: 1, paddingVertical: tokens.space[2], alignItems: "center", backgroundColor: active ? tokens.c.brand : "transparent" }}>
              <Text style={{ color: active ? tokens.c.brandContrast : tokens.c.text, fontWeight: "600", fontSize: tokens.size.sm }}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs, textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }}>
        {t("settings.appearance.theme")} {selected === "light" ? t("settings.appearance.theme.light") : selected === "dark" ? t("settings.appearance.theme.dark") : t("settings.appearance.theme.system")}
      </Text>
    </View>
  )
}
