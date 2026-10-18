import { ScrollView, Text, View, type ViewStyle } from "react-native"
import { useLocale } from "../design/LocaleProvider"
import { useTokens, type SemanticColors } from "../design/tokens"

export type KpiItem = {
  key: string
  label: string
  value: string
  /** Optional semantic tint for the value, e.g. breach monitoring status. */
  tint?: keyof SemanticColors
}

export type KpiRowProps = {
  items: KpiItem[]
}

/**
 * Horizontal KPI strip.
 *
 * Fixed-width cards inside a horizontal `ScrollView` so narrow screens scroll
 * the strip itself rather than ever widening the page.
 */
export function KpiRow({ items }: KpiRowProps) {
  const tokens = useTokens()
  const { isRTL } = useLocale()

  const tint = (item: KpiItem): string => {
    if (!item.tint) return tokens.c.textStrong
    const value = tokens.c[item.tint]
    return typeof value === "string" ? value : tokens.c.textStrong
  }

  const card: ViewStyle = {
    flexGrow: 0,
    flexShrink: 0,
    width: 152,
    padding: tokens.space[4],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.c.surface,
    borderWidth: 1,
    borderColor: tokens.c.border,
  }

  const align = isRTL ? "right" : "left"

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="list"
      contentContainerStyle={{
        gap: tokens.space[3],
        flexDirection: isRTL ? "row-reverse" : "row",
        paddingVertical: tokens.space[1],
      }}
    >
      {items.map((item) => (
        <View key={item.key} style={card}>
          <Text
            style={{
              fontSize: tokens.size.xs,
              color: tokens.c.muted,
              textAlign: align,
              writingDirection: isRTL ? "rtl" : "ltr",
            }}
          >
            {item.label}
          </Text>
          <Text
            style={{
              marginTop: tokens.space[1],
              fontSize: tokens.size.xl,
              fontWeight: "700",
              color: tint(item),
              textAlign: align,
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {item.value}
          </Text>
        </View>
      ))}
    </ScrollView>
  )
}
