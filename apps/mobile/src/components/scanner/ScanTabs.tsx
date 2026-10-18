import { Pressable, Text, View } from "react-native"
import { useLocale } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"

export type ScanKind = "url" | "message"

export type ScanTabsProps = {
  value: ScanKind
  onChange: (kind: ScanKind) => void
}

/** Tab order as rendered; mirrored for RTL by `row-reverse`. */
const ORDER: ScanKind[] = ["url", "message"]

/**
 * Segmented control mirroring the web `scan-tabs` component (P17.3).
 *
 * Same two labels ("URL Scan" / "Message Scan"), same pill styling, same
 * `tablist` semantics — only the DOM-only keyboard arrow handling is dropped,
 * since a native screen reader swipes between tabs instead.
 */
export function ScanTabs({ value, onChange }: ScanTabsProps) {
  const tokens = useTokens()
  const { t, isRTL } = useLocale()

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t("scanner.title")}
      style={{
        flexDirection: isRTL ? "row-reverse" : "row",
        backgroundColor: tokens.c.surface2,
        borderRadius: tokens.radius.full,
        padding: 4,
        gap: 4,
      }}
    >
      {ORDER.map((kind) => {
        const selected = kind === value
        return (
          <Pressable
            key={kind}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(kind)}
            style={{
              flex: 1,
              paddingVertical: tokens.space[3],
              borderRadius: tokens.radius.full,
              alignItems: "center",
              backgroundColor: selected ? tokens.c.surface : "transparent",
              borderWidth: 1,
              borderColor: selected ? tokens.c.border : "transparent",
            }}
          >
            <Text
              style={{
                color: selected ? tokens.c.textStrong : tokens.c.muted,
                fontWeight: "600",
                fontSize: tokens.size.sm,
              }}
            >
              {kind === "url" ? t("scanner.tab.urlLong") : t("scanner.tab.messageLong")}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
