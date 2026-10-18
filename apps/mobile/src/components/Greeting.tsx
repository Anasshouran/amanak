import { Text, View, type TextStyle } from "react-native"
import { useLocale, useT } from "../design/LocaleProvider"
import { useTokens } from "../design/tokens"
import { formatDate } from "../lib/format"
import { useAuth } from "../state/AuthContext"

export type GreetingProps = {
  /** Injectable clock for deterministic tests. */
  now?: Date
}

function greetingKey(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return "dashboard.greeting.morning"
  if (hour < 18) return "dashboard.greeting.afternoon"
  return "dashboard.greeting.evening"
}

function displayName(username: string | undefined, email: string | undefined): string {
  const trimmed = username?.trim()
  if (trimmed) return trimmed
  const local = email?.split("@")[0]?.trim()
  return local || ""
}

export function Greeting({ now }: GreetingProps) {
  const t = useT()
  const { locale, isRTL } = useLocale()
  const { user } = useAuth()
  const tokens = useTokens()
  const date = now ?? new Date()

  const align: TextStyle["textAlign"] = isRTL ? "right" : "left"

  return (
    <View accessibilityRole="header">
      <Text
        style={{
          fontSize: tokens.size["2xl"],
          lineHeight: tokens.size["2xl"] * tokens.lineHeight.snug,
          fontWeight: "700",
          color: tokens.c.textStrong,
          textAlign: align,
          writingDirection: isRTL ? "rtl" : "ltr",
        }}
      >
        {t(greetingKey(date), { name: displayName(user?.username, user?.email) })}
      </Text>
      <Text
        style={{
          marginTop: tokens.space[1],
          fontSize: tokens.size.base,
          lineHeight: tokens.size.base * tokens.lineHeight.normal,
          color: tokens.c.muted,
          textAlign: align,
          writingDirection: isRTL ? "rtl" : "ltr",
        }}
      >
        {t("dashboard.greeting.subtitle")}
      </Text>
      <Text
        style={{
          marginTop: tokens.space[2],
          fontSize: tokens.size.xs,
          color: tokens.c.muted,
          textAlign: align,
        }}
      >
        {formatDate(date.toISOString(), locale)}
      </Text>
    </View>
  )
}
