import { Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useLocale, useT } from "../design/LocaleProvider"
import { useTokens } from "../design/tokens"

export type MoreDestination = {
  href: string
  labelKey: string
  icon: keyof typeof Ionicons.glyphMap
  /** No route exists yet (P17.6c). Rendered but not tappable. */
  disabled?: boolean
}

/** Destinations that sit behind the More tab, in drawer order. */
export const MORE_DESTINATIONS: MoreDestination[] = [
  { href: "/breach", labelKey: "nav.breach", icon: "shield-outline" },
  { href: "/family", labelKey: "nav.family", icon: "people-outline" },
  { href: "/awareness", labelKey: "nav.awareness", icon: "bulb-outline" },
  // Settings ships in P17.6c — there is no mobile route yet.
  { href: "/settings", labelKey: "nav.settings", icon: "settings-outline", disabled: true },
  { href: "/accounts", labelKey: "nav.accounts", icon: "person-circle-outline" },
  { href: "/devices", labelKey: "nav.devices", icon: "hardware-chip-outline" },
  { href: "/incidents", labelKey: "nav.incidents", icon: "alert-circle-outline" },
  { href: "/ai", labelKey: "nav.ai", icon: "sparkles-outline" },
  { href: "/notifications", labelKey: "nav.notifications", icon: "notifications-outline" },
  { href: "/pricing", labelKey: "nav.plans", icon: "pricetags-outline" },
  { href: "/billing", labelKey: "nav.billing", icon: "card-outline" },
]

export type MoreListProps = {
  /** Called after a destination is chosen (closes the drawer). */
  onNavigate?: () => void
}

/** Tappable list of secondary destinations, shared by the drawer and /more. */
export function MoreList({ onNavigate }: MoreListProps) {
  const t = useT()
  const tokens = useTokens()
  const { isRTL } = useLocale()
  const router = useRouter()

  return (
    <View accessibilityRole="menu" style={{ gap: 2 }}>
      {MORE_DESTINATIONS.map((destination) => {
        const disabled = destination.disabled === true
        return (
          <Pressable
            key={destination.href}
            accessibilityRole="menuitem"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={() => {
              if (disabled) return
              router.push(destination.href as never)
              onNavigate?.()
            }}
            style={({ pressed }) => ({
              flexDirection: isRTL ? "row-reverse" : "row",
              alignItems: "center",
              gap: tokens.space[3],
              paddingHorizontal: tokens.space[4],
              paddingVertical: tokens.space[3],
              borderRadius: tokens.radius.md,
              opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
            })}
          >
            <Ionicons
              name={destination.icon}
              size={19}
              color={disabled ? tokens.c.muted : tokens.c.text}
            />
            <Text
              style={{
                flex: 1,
                fontSize: tokens.size.md,
                color: disabled ? tokens.c.muted : tokens.c.text,
                textAlign: isRTL ? "right" : "left",
                writingDirection: isRTL ? "rtl" : "ltr",
              }}
            >
              {t(destination.labelKey)}
            </Text>
            {!disabled ? (
              <Ionicons
                name={isRTL ? "chevron-back" : "chevron-forward"}
                size={16}
                color={tokens.c.muted}
              />
            ) : null}
          </Pressable>
        )
      })}
    </View>
  )
}
