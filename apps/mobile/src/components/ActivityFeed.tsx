import { Pressable, Text, View } from "react-native"
import type { ScanResultRecord } from "@amanak/shared-types"
import { useRouter } from "expo-router"
import { useLocale, useT } from "../design/LocaleProvider"
import { useTokens } from "../design/tokens"
import { formatRelativeTime } from "../lib/format"

export type ActivityFeedProps = {
  items: ScanResultRecord[]
  loading?: boolean
}

function verdictKey(verdict: string): string {
  if (verdict === "safe") return "scanner.verdict.safe"
  if (verdict === "suspicious") return "scanner.verdict.suspicious"
  return "scanner.verdict.dangerous"
}

function verdictColor(verdict: string, colors: { success: string; warning: string; danger: string; muted: string }): string {
  if (verdict === "safe") return colors.success
  if (verdict === "suspicious") return colors.warning
  if (verdict === "dangerous") return colors.danger
  return colors.muted
}

export function ActivityFeed({ items, loading }: ActivityFeedProps) {
  const t = useT()
  const tokens = useTokens()
  const { locale } = useLocale()
  const router = useRouter()
  const visible = items.slice(0, 5)

  return (
    <View
      style={{
        padding: tokens.space[5],
        borderRadius: tokens.radius.lg,
        backgroundColor: tokens.c.surface,
        borderWidth: 1,
        borderColor: tokens.c.border,
        width: "100%",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: tokens.space[4],
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            fontSize: tokens.size.md,
            fontWeight: "600",
            color: tokens.c.textStrong,
          }}
        >
          {t("dashboard.recentActivity")}
        </Text>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/scanner")}
          hitSlop={8}
        >
          <Text style={{ fontSize: tokens.size.xs, color: tokens.c.brand, fontWeight: "600" }}>
            {t("dashboard.activity.viewAll")}
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <Text style={{ color: tokens.c.muted }}>{t("common.loading")}</Text>
      ) : visible.length === 0 ? (
        <Text style={{ color: tokens.c.muted }}>{t("dashboard.activity.empty")}</Text>
      ) : (
        <View accessibilityRole="list" style={{ gap: tokens.space[3] }}>
          {visible.map((scan) => (
            <View
              key={scan.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.space[3],
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: verdictColor(scan.verdict, {
                    success: tokens.c.success,
                    warning: tokens.c.warning,
                    danger: tokens.c.danger,
                    muted: tokens.c.muted,
                  }),
                }}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    fontSize: tokens.size.sm,
                    color: tokens.c.text,
                  }}
                  numberOfLines={1}
                >
                  {scan.preview}
                </Text>
                <Text style={{ fontSize: tokens.size.xs, color: tokens.c.muted }}>
                  {t(verdictKey(scan.verdict))}
                </Text>
              </View>
              <Text style={{ fontSize: tokens.size.xs, color: tokens.c.muted }}>
                {formatRelativeTime(scan.created_at, locale)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
