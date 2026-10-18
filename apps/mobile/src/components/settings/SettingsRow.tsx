import { Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTokens } from "../../design/tokens"

export type SettingsRowProps = {
  /** Row label (an i18n key or literal). */
  label: string
  /** Optional trailing value (e.g. the current selection). */
  value?: string
  /** Invoked when the row is pressed. */
  onPress?: () => void
  /** Whether the row is destructive (sign out). */
  danger?: boolean
  /** Disable the row (read-only). */
  disabled?: boolean
}

/**
 * Single settings row — label on the start side, optional value + chevron on
 * the end side, mirrored for RTL.
 */
export function SettingsRow({ label, value, onPress, danger = false, disabled = false }: SettingsRowProps) {
  const tokens = useTokens()
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={disabled || !onPress ? undefined : onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: tokens.space[4],
        paddingVertical: tokens.space[3],
        borderBottomWidth: 1,
        borderBottomColor: tokens.c.border,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          color: disabled ? tokens.c.muted : tokens.c.text,
          fontSize: tokens.size.md,
        }}
      >
        {label}
      </Text>
      <View style={{ gap: tokens.space[2], alignItems: "center" }}>
        {value ? (
          <Text numberOfLines={1} style={{ color: tokens.c.muted, fontSize: tokens.size.md, writingDirection: "ltr" }}>
            {value}
          </Text>
        ) : null}
        {!disabled ? (
          <Ionicons name="chevron-forward-outline" size={16} color={tokens.c.muted} />
        ) : null}
      </View>
    </Pressable>
  )
}
