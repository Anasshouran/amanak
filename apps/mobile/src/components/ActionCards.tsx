import { Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { LinearGradient as LinearGradientRaw } from "expo-linear-gradient"
const LinearGradient = LinearGradientRaw as any
import { useT } from "../design/LocaleProvider"
import { theme } from "../theme"

export type ActionCardsProps = {
  /** Whether the breach monitor already has at least one monitored email. */
  breachEnabled: boolean
}

type ActionDef = {
  href: "/scanner" | "/breach" | "/2fa" | "/passwords"
  titleKey: string
  descKey: string
  ctaKey: string
  icon: keyof typeof Ionicons.glyphMap
  gradient: readonly [string, string]
}

const ACTIONS: ActionDef[] = [
  {
    href: "/scanner",
    titleKey: "dashboard.actions.scan.title",
    descKey: "dashboard.actions.scan.desc",
    ctaKey: "dashboard.actions.scan.cta",
    icon: "search-outline",
    gradient: ["#1D4ED8", "#3B82F6"],
  },
  {
    href: "/breach",
    titleKey: "dashboard.actions.breach.title",
    descKey: "dashboard.actions.breach.desc",
    ctaKey: "dashboard.actions.breach.enable",
    icon: "shield-outline",
    gradient: ["#10B981", "#2ECC71"],
  },
  {
    href: "/2fa",
    titleKey: "dashboard.actions.twofa.title",
    descKey: "dashboard.actions.twofa.desc",
    ctaKey: "dashboard.actions.twofa.cta",
    icon: "key-outline",
    gradient: ["#7C3AED", "#A78BFA"],
  },
  {
    href: "/passwords",
    titleKey: "dashboard.actions.passwords.title",
    descKey: "dashboard.actions.passwords.desc",
    ctaKey: "dashboard.actions.passwords.cta",
    icon: "lock-closed-outline",
    gradient: ["#EA580C", "#FB923C"],
  },
]

export function ActionCards({ breachEnabled }: ActionCardsProps) {
  const t = useT()
  const router = useRouter()

  return (
    <View accessibilityRole="list" style={{ gap: theme.space.md }}>
      <View style={{ flexDirection: "row", gap: theme.space.md }}>
        {ACTIONS.slice(0, 2).map((action) => renderCard(action, t, router, breachEnabled))}
      </View>
      <View style={{ flexDirection: "row", gap: theme.space.md }}>
        {ACTIONS.slice(2, 4).map((action) => renderCard(action, t, router, breachEnabled))}
      </View>
    </View>
  )
}

function renderCard(action: ActionDef, t: (k: string) => string, router: any, breachEnabled: boolean) {
  const ctaLabel =
    action.href === "/breach"
      ? t(breachEnabled ? "dashboard.actions.breach.check" : "dashboard.actions.breach.enable")
      : t(action.ctaKey)
  return (
    <Pressable
      key={action.href}
      accessibilityRole="button"
      accessibilityLabel={t(action.titleKey)}
      onPress={() => router.push(action.href)}
      style={({ pressed }) => ({
        flex: 1,
        borderRadius: theme.radius.lg,
        overflow: "hidden",
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <LinearGradient
        colors={action.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          padding: theme.space.lg,
          minHeight: 110,
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.radius.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.2)",
          }}
        >
          <Ionicons name={action.icon} size={18} color="#FFFFFF" />
        </View>
        <View style={{ gap: 2 }}>
          <Text
            style={{
              fontSize: theme.font.size.md,
              fontWeight: theme.font.weight.bold,
              color: "#FFFFFF",
              fontFamily: "Cairo_700Bold",
            }}
          >
            {t(action.titleKey)}
          </Text>
          <Text
            style={{
              fontSize: theme.font.size.xs,
              color: "rgba(255,255,255,0.85)",
              fontFamily: "Cairo_400Regular",
            }}
            numberOfLines={2}
          >
            {t(action.descKey)}
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  )
}
