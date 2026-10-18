import { Pressable, Text, View } from "react-native"
import type { ScanResultRecord, ScanVerdict } from "@amanak/shared-types"
import { useLocale } from "../../design/LocaleProvider"
import { useTokens, type SemanticColors } from "../../design/tokens"
import { formatRelativeTime } from "../../lib/format"

export type ScanHistoryMobileProps = {
  items: ScanResultRecord[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  onSelect?: (item: ScanResultRecord) => void
  /** Controlled "View all" toggle state. */
  expanded?: boolean
  onToggleExpanded?: () => void
}

/** How many items the collapsed panel shows — same cut-off as the web sidebar. */
export const HISTORY_COLLAPSED_COUNT = 5

function dotColor(verdict: ScanVerdict, c: SemanticColors): string {
  if (verdict === "safe") return c.success
  if (verdict === "suspicious") return c.warning
  return c.danger
}

/**
 * Scan history list mirroring the web `scan-sidebar` (P17.3), but rendered
 * *below* the result on mobile instead of beside it.
 *
 * Each row is the same triage line the web client shows: verdict dot, truncated
 * (already redacted) preview, then "verdict · relative time". Tapping a row
 * re-shows that stored result.
 */
export function ScanHistoryMobile({
  items,
  loading = false,
  error,
  onRetry,
  onSelect,
  expanded = false,
  onToggleExpanded,
}: ScanHistoryMobileProps) {
  const tokens = useTokens()
  const { t, locale, isRTL } = useLocale()
  const align = isRTL ? "right" : "left"

  return (
    <View
      style={{
        backgroundColor: tokens.c.surface,
        borderRadius: tokens.radius.lg,
        borderWidth: 1,
        borderColor: tokens.c.border,
        padding: tokens.space[4],
        gap: tokens.space[3],
      }}
    >
      <Text style={{ color: tokens.c.textStrong, fontSize: tokens.size.lg, fontWeight: "700", textAlign: isRTL ? "right" : "left" }}>
        {t("scanner.history.title")}
      </Text>

      {loading ? (
        <View style={{ gap: tokens.space[2] }}>
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={{
                height: 44,
                borderRadius: tokens.radius.md,
                backgroundColor: tokens.c.surface2,
              }}
            />
          ))}
        </View>
      ) : error ? (
        <View style={{ gap: tokens.space[2] }}>
          <Text accessibilityRole="alert" style={{ color: tokens.c.danger }}>
            {error}
          </Text>
          {onRetry ? (
            <Pressable accessibilityRole="button" onPress={onRetry}>
              <Text style={{ color: tokens.c.brand }}>{t("scanner.action.tryAgain")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : items.length === 0 ? (
        <Text style={{ color: tokens.c.muted }}>{t("scanner.history.empty")}</Text>
      ) : (
        <>
          {(expanded ? items : items.slice(0, HISTORY_COLLAPSED_COUNT)).map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${t("scanner.history.viewResult")}: ${item.preview}`}
              onPress={() => onSelect?.(item)}
              style={{
                flexDirection: isRTL ? "row-reverse" : "row",
                alignItems: "center",
                gap: tokens.space[3],
                paddingVertical: tokens.space[2],
                borderTopWidth: 1,
                borderTopColor: tokens.c.border,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: dotColor(item.verdict, tokens.c),
                }}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: tokens.c.text,
                    textAlign: "left",
                    writingDirection: "ltr",
                  }}
                >
                  {item.preview}
                </Text>
                <Text style={{ color: tokens.c.muted, fontSize: tokens.size["2xs"], textAlign: align }}>
                  {t(`scanner.verdict.${item.verdict}`)} ·{" "}
                  {formatRelativeTime(item.created_at, locale)}
                </Text>
              </View>
            </Pressable>
          ))}

          {items.length > HISTORY_COLLAPSED_COUNT ? (
            <Pressable accessibilityRole="button" onPress={onToggleExpanded}>
              <Text
                style={{
                  color: tokens.c.brand,
                  textAlign: align,
                  paddingVertical: tokens.space[1],
                }}
              >
                {expanded ? t("scanner.history.showLess") : t("scanner.history.viewAll")}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  )
}
