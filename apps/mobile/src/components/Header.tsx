import { useEffect, useState } from "react"
import { Modal, Pressable, Text, View, type ViewStyle } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { api } from "../lib/api"
import { useAuth } from "../state/AuthContext"
import { useLocale, useT } from "../design/LocaleProvider"
import { useTheme } from "../design/ThemeProvider"
import { useTokens } from "../design/tokens"

export type HeaderProps = {
  /** Contextual page title, rendered at the start side. */
  title: string
}

const HEADER_HEIGHT = 56

/**
 * App bar: title on the start side; notifications, theme and account menu on
 * the end side (mirrored automatically in RTL via `row-reverse`).
 */
export function Header({ title }: HeaderProps) {
  const tokens = useTokens()
  const { theme, resolvedTheme, toggleTheme } = useTheme()
  const { toggleLocale, t, isRTL } = useLocale()
  const { user, logout } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [menuOpen, setMenuOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let active = true
    api
      .listNotifications()
      .then((data) => {
        if (active) setUnread(data.unread)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  async function signOut() {
    setMenuOpen(false)
    await logout()
    router.replace("/login")
  }

  const menuPanel: ViewStyle = {
    position: "absolute",
    top: insets.top + HEADER_HEIGHT + 8,
    minWidth: 208,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.c.elevated,
    borderWidth: 1,
    borderColor: tokens.c.border,
    paddingVertical: tokens.space[1],
    // Pin to the end side of the screen, mirrored for RTL.
    ...(isRTL ? { left: 12 } : { right: 12 }),
  }

  const menuItem = (disabled = false): ViewStyle => ({
    paddingHorizontal: tokens.space[4],
    paddingVertical: tokens.space[3],
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space[3],
    opacity: disabled ? 0.45 : 1,
  })

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: tokens.c.surface,
        borderBottomWidth: 1,
        borderBottomColor: tokens.c.border,
      }}
    >
      <View
        style={{
          height: HEADER_HEIGHT,
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          paddingHorizontal: tokens.space[4],
          gap: tokens.space[2],
        }}
      >
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            fontSize: tokens.size.lg,
            fontWeight: "700",
            color: tokens.c.textStrong,
            textAlign: isRTL ? "right" : "left",
            writingDirection: isRTL ? "rtl" : "ltr",
          }}
          numberOfLines={1}
        >
          {title}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("header.notifications")}
          hitSlop={8}
          onPress={() => router.push("/notifications")}
          style={{ padding: tokens.space[2] }}
        >
          <View>
            <Ionicons name="notifications-outline" size={22} color={tokens.c.muted} />
            {unread > 0 ? (
              <View
                accessibilityLabel={String(unread)}
                style={{
                  position: "absolute",
                  top: -3,
                  ...(isRTL ? { left: -3 } : { right: -3 }),
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  paddingHorizontal: 3,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: tokens.c.danger,
                }}
              >
                <Text style={{ color: "#ffffff", fontSize: 10, fontWeight: "700" }}>
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("header.toggleTheme")}
          hitSlop={8}
          onPress={toggleTheme}
          style={{ padding: tokens.space[2] }}
        >
          <Ionicons
            name={theme === "dark" ? "sunny-outline" : "moon-outline"}
            size={22}
            color={tokens.c.muted}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("header.toggleLocale")}
          hitSlop={8}
          onPress={toggleLocale}
          style={{ padding: tokens.space[2] }}
        >
          <Text style={{ fontSize: tokens.size.xs, fontWeight: "700", color: tokens.c.muted }}>
            {isRTL ? "EN" : "ع"}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("header.userMenu")}
          hitSlop={8}
          onPress={() => setMenuOpen(true)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: tokens.c.brand,
          }}
        >
          <Text style={{ color: tokens.c.brandContrast, fontWeight: "700", fontSize: tokens.size.sm }}>
            {(user?.username || user?.email || "?").charAt(0).toUpperCase()}
          </Text>
        </Pressable>
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable
          accessibilityRole="none"
          onPress={() => setMenuOpen(false)}
          style={{ flex: 1, backgroundColor: tokens.c.overlay }}
        >
          <View style={menuPanel}>
            <Pressable
              accessibilityRole="menuitem"
              onPress={() => {
                setMenuOpen(false)
                router.push("/accounts")
              }}
              style={menuItem()}
            >
              <Ionicons name="person-outline" size={18} color={tokens.c.text} />
              <Text style={{ color: tokens.c.text, fontSize: tokens.size.sm }}>
                {t("user.profile")}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="menuitem"
              onPress={() => {
                setMenuOpen(false)
                router.push("/settings")
              }}
              style={menuItem()}
            >
              <Ionicons name="settings-outline" size={18} color={tokens.c.text} />
              <Text style={{ color: tokens.c.text, fontSize: tokens.size.sm }}>
                {t("nav.settings")}
              </Text>
            </Pressable>

            <Pressable accessibilityRole="menuitem" onPress={() => void signOut()} style={menuItem()}>
              <Ionicons name="log-out-outline" size={18} color={tokens.c.danger} />
              <Text style={{ color: tokens.c.danger, fontSize: tokens.size.sm }}>
                {t("actions.signOut")}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}
