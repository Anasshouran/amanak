import { Pressable, Text, View } from "react-native"
import { useTokens } from "../../design/tokens"
import { useLocale } from "../../design/LocaleProvider"

type LocaleOption = "ar" | "en"

const OPTIONS: LocaleOption[] = ["ar", "en"]

/**
 * Locale picker — Arabic / English. Toggling writes the preference and flips
 * the layout direction (RTL) for the whole app.
 */
export function LocalePicker() {
  const tokens = useTokens()
  const { locale, toggleLocale, t, isRTL } = useLocale()

  return (
    <View style={{ gap: tokens.space[2], paddingHorizontal: tokens.space[4] }}>
      <Text style={{ color: tokens.c.muted, fontSize: tokens.size.sm, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>
        {t("settings.appearance.language")}
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
          const active = locale === option
          const label = option === "ar" ? "العربية" : "English"
          return (
            <Pressable key={option} onPress={toggleLocale} style={{ flex: 1, paddingVertical: tokens.space[2], alignItems: "center", backgroundColor: active ? tokens.c.brand : "transparent" }}>
              <Text style={{ color: active ? tokens.c.brandContrast : tokens.c.text, fontWeight: "600", fontSize: tokens.size.sm }}>{label}</Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs, textAlign: isRTL ? "right" : "left", writingDirection: isRTL ? "rtl" : "ltr" }}>
        {locale.toUpperCase()}
      </Text>
    </View>
  )
}
