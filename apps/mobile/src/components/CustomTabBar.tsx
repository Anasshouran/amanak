import { Pressable, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { LinearGradient as LinearGradientRaw } from "expo-linear-gradient"
const LinearGradient = LinearGradientRaw as any
import { Ionicons } from "@expo/vector-icons"
import { useLocale, useT } from "../design/LocaleProvider"
import { theme } from "../theme"

type TabItem = {
  name: string
  label: string
  icon: keyof typeof Ionicons.glyphMap
  iconActive: keyof typeof Ionicons.glyphMap
}

const TABS: TabItem[] = [
  { name: "dashboard", label: "Home", icon: "home-outline", iconActive: "home" },
  { name: "scanner", label: "Scan", icon: "search-outline", iconActive: "search" },
  { name: "2fa", label: "Vault", icon: "shield-outline", iconActive: "shield" },
  { name: "passwords", label: "Keys", icon: "key-outline", iconActive: "key" },
  { name: "settings", label: "Settings", icon: "settings-outline", iconActive: "settings" },
  { name: "more", label: "More", icon: "ellipsis-horizontal-outline", iconActive: "ellipsis-horizontal" },
]

export type CustomTabBarProps = {
  state: { index: number; routes: { name: string; key: string }[] }
  navigation: { navigate: (name: string) => void }
  onMorePress?: () => void
}

export function CustomTabBar({ state, navigation, onMorePress }: CustomTabBarProps) {
  const insets = useSafeAreaInsets()
  const { isRTL } = useLocale()
  const t = useT()

  return (
    <View
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom, 12),
        borderRadius: theme.radius.xl,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: theme.color.border,
      }}
    >
      <LinearGradient
        colors={["rgba(11,30,58,0.95)", "rgba(5,10,21,0.98)"]}
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          justifyContent: "space-around",
          paddingVertical: 8,
          paddingHorizontal: 4,
        }}
      >
        {TABS.map((tab, idx) => {
          const active = state.index === idx
          return (
            <Pressable
              key={tab.name}
              onPress={() => {
                if (tab.name === "more") onMorePress?.()
                else navigation.navigate(tab.name)
              }}
              style={{ alignItems: "center", flex: 1, paddingVertical: 4 }}
            >
              {active && (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: theme.color.glowSoft,
                  }}
                />
              )}
              <Ionicons
                name={active ? tab.iconActive : tab.icon}
                size={22}
                color={active ? theme.color.glow : theme.color.textMuted}
              />
              <Text
                style={{
                  marginTop: 2,
                  fontSize: theme.font.size.xs,
                  color: active ? theme.color.glow : theme.color.textMuted,
                  fontFamily: "Cairo_600SemiBold",
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          )
        })}
      </LinearGradient>
    </View>
  )
}
