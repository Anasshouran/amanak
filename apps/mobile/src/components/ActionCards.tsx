import { Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useT } from "../design/LocaleProvider"
import { useTokens } from "../design/tokens"

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
  primary?: boolean
}

const ACTIONS: ActionDef[] = [
  {
    href: "/scanner",
    titleKey: "dashboard.actions.scan.title",
    descKey: "dashboard.actions.scan.desc",
    ctaKey: "dashboard.actions.scan.cta",
    icon: "search-outline",
    primary: true,
  },
  {
    href: "/breach",
    titleKey: "dashboard.actions.breach.title",
    descKey: "dashboard.actions.breach.desc",
    ctaKey: "dashboard.actions.breach.enable",
    icon: "shield-outline",
  },
  {
    href: "/2fa",
    titleKey: "dashboard.actions.twofa.title",
    descKey: "dashboard.actions.twofa.desc",
    ctaKey: "dashboard.actions.twofa.cta",
    icon: "key-outline",
  },
  {
    href: "/passwords",
    titleKey: "dashboard.actions.passwords.title",
    descKey: "dashboard.actions.passwords.desc",
    ctaKey: "dashboard.actions.passwords.cta",
    icon: "lock-closed-outline",
  },
]

export function ActionCards({ breachEnabled }: ActionCardsProps) {
  const t = useT()
  const tokens = useTokens()
  const router = useRouter()

  return (
    <View accessibilityRole="list" style={{ gap: tokens.space[3] }}>
      {ACTIONS.map((action) => {
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
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.space[4],
              padding: tokens.space[4],
              borderRadius: tokens.radius.lg,
              backgroundColor: tokens.c.surface,
              borderWidth: 1,
              borderColor: action.primary ? tokens.c.brand : tokens.c.border,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: tokens.radius.md,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: action.primary ? tokens.c.brand : tokens.c.surface2,
              }}
            >
              <Ionicons
                name={action.icon}
                size={20}
                color={action.primary ? tokens.c.brandContrast : tokens.c.brand}
              />
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontSize: tokens.size.md,
                  fontWeight: "600",
                  color: tokens.c.textStrong,
                  textAlign: "left",
                }}
              >
                {t(action.titleKey)}
              </Text>
              <Text
                style={{
                  fontSize: tokens.size.xs,
                  color: tokens.c.muted,
                  textAlign: "left",
                }}
                numberOfLines={2}
              >
                {t(action.descKey)}
              </Text>
            </View>

            <Text
              style={{
                fontSize: tokens.size.xs,
                fontWeight: "600",
                color: action.primary ? tokens.c.brand : tokens.c.muted,
              }}
            >
              {ctaLabel}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}
