import { Pressable, Text, View } from "react-native"
import type { ScoreHistoryResponse } from "@amanak/shared-types"
import { useT } from "../design/LocaleProvider"
import { useTokens } from "../design/tokens"
import { ProgressRing } from "./ProgressRing"
import { theme } from "../theme"

export type ScoreCardProps = {
  score: number
  history: ScoreHistoryResponse | null
  loading?: boolean
  error?: unknown
  onRetry?: () => void
}

type Level = "good" | "fair" | "weak"

export function levelOf(score: number): Level {
  if (score >= 70) return "good"
  if (score >= 40) return "fair"
  return "weak"
}

export function ScoreCard({ score, history, loading, error, onRetry }: ScoreCardProps) {
  const t = useT()
  const tokens = useTokens()

  const card = {
    padding: tokens.space[5],
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.c.surface,
    borderWidth: 1,
    borderColor: tokens.c.border,
    width: "100%" as const,
  }
  // Theme alias (new design system) — used for the shield glow.
  const T = theme

  const level = levelOf(Math.round(score))
  const statusLabel = t(`dashboard.score.status.${level}`)

  const points = history?.points ?? []
  const delta = history?.delta ?? 0
  const trend = history?.trend ?? "flat"
  const hasTrend = points.length >= 2

  const deltaColor =
    delta > 0 ? tokens.c.success : delta < 0 ? tokens.c.danger : tokens.c.muted
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "■"
  const prev = points.length > 0 ? points[0].score : Math.round(score) - delta
  const prevText =
    trend === "up"
      ? t("dashboard.score.improved", { prev })
      : trend === "down"
        ? t("dashboard.score.declined", { prev })
        : t("dashboard.score.steady")

  const levelColor =
    level === "good" ? theme.color.glow : level === "fair" ? tokens.c.warning : tokens.c.danger

  return (
    <View style={card}>
      <Text
        style={{
          fontSize: tokens.size.sm,
          fontWeight: "600",
          color: tokens.c.muted,
          marginBottom: tokens.space[4],
          textAlign: "left",
        }}
      >
        {t("dashboard.score.title")}
      </Text>

      {loading ? (
        <Text style={{ color: tokens.c.muted, textAlign: "left" }}>{t("common.loading")}</Text>
      ) : error ? (
        <View>
          <Text style={{ color: tokens.c.danger, textAlign: "left" }}>
            {t("dashboard.score.error")}
          </Text>
          {onRetry ? (
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              style={{
                marginTop: tokens.space[3],
                alignSelf: "flex-start",
                paddingHorizontal: tokens.space[4],
                paddingVertical: tokens.space[2],
                borderRadius: tokens.radius.md,
                backgroundColor: tokens.c.brand,
              }}
            >
              <Text style={{ color: tokens.c.brandContrast, fontWeight: "600" }}>
                {t("actions.retry")}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View
          accessibilityLabel={t("dashboard.score.aria", {
            score: Math.round(score),
            status: statusLabel,
          })}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: tokens.space[5],
            flexWrap: "wrap",
          }}
        >
          <ProgressRing
            value={score}
            size={132}
            stroke={12}
            label={Math.round(score)}
            caption={t("dashboard.score.denominator")}
          />
          <View style={{ flex: 1, minWidth: 140, gap: tokens.space[2] }}>
            <Text
              style={{
                color: levelColor,
                fontSize: tokens.size.lg,
                fontWeight: "700",
                textAlign: "left",
              }}
            >
              {statusLabel}
            </Text>
            {hasTrend ? (
              <Text style={{ color: deltaColor, fontSize: tokens.size.sm, textAlign: "left" }}>
                {arrow} {delta > 0 ? "+" : ""}
                {delta}
                <Text style={{ color: tokens.c.muted }}> {prevText}</Text>
              </Text>
            ) : (
              <Text style={{ color: tokens.c.muted, fontSize: tokens.size.sm, textAlign: "left" }}>
                {t("dashboard.score.steady")}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  )
}
