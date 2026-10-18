import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native"
import { useLocale } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"
import type { ScanKind } from "./ScanTabs"
export type ScanInputProps = {
  kind: ScanKind
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  busy?: boolean
  error?: string | null
}

/**
 * Input card mirroring the web `scan-input-card` (P17.3).
 *
 * The field is multiline in both modes — URL mode keeps `dir="ltr"` so a pasted
 * link is not visually reordered inside an Arabic layout. The submit button is
 * disabled while empty (mobile spec) or while a scan is in flight.
 */
export function ScanInput({ kind, value, onChange, onSubmit, busy = false, error }: ScanInputProps) {
  const tokens = useTokens()
  const { t, isRTL } = useLocale()

  const empty = value.trim().length === 0
  const disabled = busy || empty
  const align = isRTL ? "right" : "left"

  return (
    <View style={{ gap: tokens.space[3] }}>
      <Text
        style={{
          color: tokens.c.text,
          fontWeight: "600",
          fontSize: tokens.size.sm,
          textAlign: align,
          writingDirection: isRTL ? "rtl" : "ltr",
        }}
      >
        {kind === "url" ? t("scanner.input.urlLabel") : t("scanner.input.messageLabel")}
      </Text>

      <TextInput
        accessible
        accessibilityLabel={
          kind === "url" ? t("scanner.input.urlLabel") : t("scanner.input.messageLabel")
        }
        multiline
        value={value}
        onChangeText={onChange}
        placeholder={
          kind === "url"
            ? t("scanner.input.urlPlaceholder")
            : t("scanner.input.messagePlaceholder")
        }
        placeholderTextColor={tokens.c.muted}
        autoCapitalize="none"
        autoCorrect={false}
        // URL mode: keep the text direction LTR regardless of the UI language.
        style={{
          minHeight: kind === "message" ? 112 : 56,
          textAlignVertical: "top",
          backgroundColor: tokens.c.surface2,
          borderWidth: 1,
          borderColor: error ? tokens.c.danger : tokens.c.border,
          borderRadius: tokens.radius.md,
          padding: tokens.space[3],
          color: tokens.c.text,
          writingDirection: kind === "url" ? "ltr" : isRTL ? "rtl" : "ltr",
        }}
      />

      <Text
        style={{
          color: tokens.c.muted,
          fontSize: tokens.size["2xs"],
          textAlign: align,
          writingDirection: isRTL ? "rtl" : "ltr",
        }}
      >
        {t("scanner.input.hint")}
      </Text>

      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: tokens.c.danger, fontSize: tokens.size.sm, textAlign: align }}
        >
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, busy }}
        accessibilityLabel={busy ? t("scanner.scanning") : t("scanner.submit")}
        disabled={disabled}
        onPress={onSubmit}
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: tokens.space[2],
          paddingVertical: tokens.space[3],
          borderRadius: tokens.radius.md,
          backgroundColor: tokens.c.brand,
          opacity: disabled ? 0.55 : 1,
          alignSelf: "flex-end",
          paddingHorizontal: tokens.space[6],
        }}
      >
        {busy ? <ActivityIndicator color={tokens.c.brandContrast} size="small" /> : null}
        <Text style={{ color: tokens.c.brandContrast, fontWeight: "700" }}>
          {busy ? t("scanner.scanning") : t("scanner.submit")}
        </Text>
      </Pressable>
    </View>
  )
}
