import { Ionicons } from "@expo/vector-icons"
import { Text, View } from "react-native"
import { useLocale } from "../design/LocaleProvider"
import { useTokens } from "../design/tokens"
import { useContext_ } from "../design/ContextProvider"

/**
 * Tenant-context pill shown under the header on data tabs (P18.1c2).
 *
 * Renders nothing in the personal context — the personal workspace is the
 * implicit default and a permanent "Personal" pill would be noise.
 */
export function ContextBadge() {
  const tokens = useTokens()
  const { isRTL, t } = useLocale()
  const { contextId, contextName } = useContext_()

  if (!contextId) return null

  return (
    <View
      style={{
        flexDirection: isRTL ? "row-reverse" : "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: tokens.space[2],
        marginHorizontal: tokens.space[4],
        marginTop: tokens.space[3],
        paddingHorizontal: tokens.space[3],
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: tokens.c.brand,
        backgroundColor: tokens.c.surface,
      }}
    >
      <Ionicons name="business-outline" size={14} color={tokens.c.brand} />
      <Text style={{ color: tokens.c.brand, fontSize: tokens.size.xs, fontWeight: "700" }}>
        {contextName}
      </Text>
    </View>
  )
}

/** Personal-context neutral variant (used where an explicit label is wanted). */
export function ContextBadgePersonal() {
  const tokens = useTokens()
  const { t } = useLocale()
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: tokens.space[2],
        paddingHorizontal: tokens.space[3],
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: tokens.c.border,
        backgroundColor: tokens.c.surface,
      }}
    >
      <Ionicons name="home-outline" size={14} color={tokens.c.muted} />
      <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs, fontWeight: "600" }}>
        {t("context.personal")}
      </Text>
    </View>
  )
}
