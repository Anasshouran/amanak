import { useState } from "react"
import { Ionicons } from "@expo/vector-icons"
import { Modal, Pressable, ScrollView, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocale } from "../design/LocaleProvider"
import { useTokens } from "../design/tokens"
import { useContext_ } from "../design/ContextProvider"

/**
 * Header trigger + bottom-sheet action list for switching tenant context
 * (P18.1c2). With no organizations it renders a static "Personal" label so
 * there is nothing to switch to.
 */
export function ContextSwitcher() {
  const tokens = useTokens()
  const { isRTL, t } = useLocale()
  const { contextId, contextName, organizations, switchContext } = useContext_()
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)

  const label = contextId ? contextName : t("context.switcher.personal")

  const options: Array<{
    id: string | null
    name: string
    icon: "home-outline" | "business-outline"
  }> = [
    { id: null, name: t("context.switcher.personal"), icon: "home-outline" },
    ...organizations.map((org) => ({
      id: org.id,
      name: org.name,
      icon: "business-outline" as const,
    })),
  ]

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("context.switcher.title")}
        disabled={organizations.length === 0}
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.space[1],
          padding: tokens.space[2],
        }}
      >
        <Ionicons
          name={contextId ? "business-outline" : "home-outline"}
          size={20}
          color={tokens.c.muted}
        />
        <Text
          numberOfLines={1}
          style={{
            maxWidth: 96,
            color: tokens.c.muted,
            fontSize: tokens.size.xs,
            fontWeight: "600",
          }}
        >
          {label}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: tokens.c.overlay }}
        >
          <View
            style={{
              marginTop: "auto",
              paddingBottom: insets.bottom + tokens.space[3],
              backgroundColor: tokens.c.elevated,
              borderTopLeftRadius: tokens.radius.lg,
              borderTopRightRadius: tokens.radius.lg,
              paddingTop: tokens.space[3],
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                paddingHorizontal: tokens.space[4],
                paddingBottom: tokens.space[3],
                color: tokens.c.textStrong,
                fontSize: tokens.size.md,
                fontWeight: "700",
                textAlign: isRTL ? "right" : "left",
              }}
            >
              {t("context.switcher.title")}
            </Text>
            <ScrollView>
              {options.map((option) => {
                const selected = option.id === contextId
                return (
                  <Pressable
                    key={option.id ?? "personal"}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setOpen(false)
                      if (option.id !== contextId) switchContext(option.id)
                    }}
                    style={{
                      flexDirection: isRTL ? "row-reverse" : "row",
                      alignItems: "center",
                      gap: tokens.space[3],
                      paddingHorizontal: tokens.space[4],
                      paddingVertical: tokens.space[3],
                    }}
                  >
                    <Ionicons name={option.icon} size={20} color={tokens.c.muted} />
                    <Text
                      style={{
                        flex: 1,
                        color: tokens.c.text,
                        fontSize: tokens.size.sm,
                        textAlign: isRTL ? "right" : "left",
                      }}
                    >
                      {option.name}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={18} color={tokens.c.brand} />
                    ) : null}
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  )
}
