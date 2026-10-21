import { useEffect, useRef, useState } from "react"
import { Animated, Modal, Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { Redirect, Tabs } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { MoreList } from "../../src/components/MoreList"
import { useLocale, useT } from "../../src/design/LocaleProvider"
import { useContext_ } from "../../src/design/ContextProvider"
import { useReducedMotion } from "../../src/design/motion"
import { useTokens } from "../../src/design/tokens"
import { useAuth } from "../../src/state/AuthContext"

/** Secondary destinations hidden behind the More tab. */
const HIDDEN_FROM_TAB_BAR = [
  "accounts",
  "ai",
  "awareness",
  "billing",
  "breach",
  "devices",
  "family",
  "incidents",
  "notifications",
  "pricing",
]

function TabIcon({
  name,
  color,
  size,
}: {
  name: keyof typeof Ionicons.glyphMap
  color: string
  size: number
}) {
  return <Ionicons name={name} size={size} color={color} />
}

/** Slide-in panel listing the secondary destinations. */
function MoreDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const tokens = useTokens()
  const { isRTL, t } = useLocale()
  const insets = useSafeAreaInsets()
  const reducedMotion = useReducedMotion()
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) return
    progress.setValue(0)
    Animated.timing(progress, {
      toValue: 1,
      duration: reducedMotion ? 0 : tokens.duration.base,
      useNativeDriver: true,
    }).start()
  }, [visible, progress, reducedMotion, tokens.duration.base])

  // Drawer sits on the *end* side, so it flips to the left in RTL.
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [isRTL ? -300 : 300, 0],
  })

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, flexDirection: isRTL ? "row-reverse" : "row" }}>
        <Pressable
          accessibilityLabel={t("common.close")}
          onPress={onClose}
          style={{ flex: 1, backgroundColor: tokens.c.overlay }}
        />
        <Animated.View
          style={{
            width: 300,
            maxWidth: "86%",
            height: "100%",
            backgroundColor: tokens.c.surface,
            paddingTop: insets.top + tokens.space[2],
            paddingBottom: insets.bottom + tokens.space[4],
            transform: [{ translateX }],
          }}
        >
          <View
            style={{
              paddingHorizontal: tokens.space[4],
              paddingBottom: tokens.space[3],
              marginBottom: tokens.space[2],
              borderBottomWidth: 1,
              borderBottomColor: tokens.c.border,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                fontSize: tokens.size.xl,
                fontWeight: "700",
                color: tokens.c.textStrong,
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {t("nav.more")}
            </Text>
          </View>
          <MoreList onNavigate={onClose} />
        </Animated.View>
      </View>
    </Modal>
  )
}

function TabsNavigator() {
  const { user, loading } = useAuth()
  const { contextId } = useContext_()
  const tokens = useTokens()
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const [moreOpen, setMoreOpen] = useState(false)

  // The org dashboard is a first-class tab only while an organization context
  // is active (P18.2); otherwise it stays hidden behind the More drawer.
  const inOrgContext = Boolean(contextId)

  if (loading) {
    return (
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.c.bg }}
      >
        <Text style={{ color: tokens.c.muted }}>{t("common.loading")}</Text>
      </View>
    )
  }
  if (!user) {
    return <Redirect href="/login" />
  }

  return (
    <>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: tokens.c.surface },
          headerTintColor: tokens.c.text,
          headerTitleStyle: { color: tokens.c.textStrong, fontWeight: "700" },
          tabBarStyle: {
            backgroundColor: tokens.c.surface,
            borderTopColor: tokens.c.border,
            borderTopWidth: 1,
            height: 56 + insets.bottom,
            paddingTop: 8,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          },
          tabBarActiveTintColor: tokens.c.brand,
          tabBarInactiveTintColor: tokens.c.muted,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: t("nav.dashboard"),
            headerShown: false,
            tabBarIcon: ({ color, size }) => <TabIcon name="home-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="scanner"
          options={{
            title: t("nav.scanner"),
            tabBarIcon: ({ color, size }) => <TabIcon name="search-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="2fa"
          options={{
            title: t("nav.2fa"),
            tabBarIcon: ({ color, size }) => <TabIcon name="shield-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="passwords"
          options={{
            title: t("nav.passwords"),
            tabBarIcon: ({ color, size }) => <TabIcon name="key-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t("nav.settings"),
            tabBarIcon: ({ color, size }) => <TabIcon name="settings-outline" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: t("nav.more"),
            tabBarIcon: ({ color, size }) => (
              <TabIcon name="ellipsis-horizontal-outline" color={color} size={size} />
            ),
          }}
          listeners={{
            tabPress: (event) => {
              event.preventDefault()
              setMoreOpen(true)
            },
          }}
        />

        <Tabs.Screen
          name="org"
          options={{
            title: t("org.dashboard.title"),
            href: inOrgContext ? undefined : null,
            tabBarIcon: ({ color, size }) => (
              <TabIcon name="business-outline" color={color} size={size} />
            ),
          }}
        />

        {HIDDEN_FROM_TAB_BAR.map((name) => (
          <Tabs.Screen key={name} name={name} options={{ href: null }} />
        ))}
      </Tabs>

      <MoreDrawer visible={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}

export default function TabsLayout() {
  return <TabsNavigator />
}
