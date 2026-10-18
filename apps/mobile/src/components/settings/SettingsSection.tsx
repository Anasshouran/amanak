import { Text, View } from "react-native"
import { useTokens } from "../../design/tokens"

export type SettingsSectionProps = {
  label: string
  children?: React.ReactNode
}

/**
 * Section header within the settings screen, separated from the rows above.
 */
export function SettingsSection({ label, children }: SettingsSectionProps) {
  const tokens = useTokens()
  return (
    <View style={{ gap: tokens.space[2], paddingHorizontal: tokens.space[4], marginTop: tokens.space[4] }}>
      <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 }}>
        {label}
      </Text>
      {children}
    </View>
  )
}
