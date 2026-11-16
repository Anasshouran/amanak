import { ScrollView, Text, View } from "react-native"
import { MoreList } from "../../components/MoreList"
import { useLocale, useT } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"

/**
 * Full-screen fallback for the More tab.
 *
 * Tapping the tab opens the slide-in drawer instead (see `_layout.tsx`); this
 * route still exists so `/more` deep links resolve rather than 404-ing.
 */
export default function More() {
  const tokens = useTokens()
  const { isRTL, t } = useLocale()

  return (
    <View style={{ flex: 1, backgroundColor: "#0B1E3A" }}>
      <ScrollView contentContainerStyle={{ padding: tokens.space[4], paddingTop: tokens.space[6] }}>
        <Text
          accessibilityRole="header"
          style={{
            fontSize: tokens.size["2xl"],
            fontWeight: "700",
            color: tokens.c.textStrong,
            textAlign: isRTL ? "right" : "left",
            marginBottom: tokens.space[4],
          }}
        >
          {t("nav.more")}
        </Text>
        <MoreList />
      </ScrollView>
    </View>
  )
}
