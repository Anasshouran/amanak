import { useState } from "react"
import { Pressable, Text, View } from "react-native"
import * as Clipboard from "expo-clipboard"
import { useLocale } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"

/** TOTP period, in seconds — matches `src/lib/vault/totp.ts`. */
const PERIOD = 30

export type TotpDisplayMobileProps = {
  /** Null until the entry decrypts; renders a placeholder block then. */
  code: string | null
  /** Whole seconds left in the current 30 s window. */
  secondsRemaining: number
  /** Single-reveal: only the tapped card shows its digits. */
  revealed: boolean
  /** Used for the copy button's accessible name. */
  issuer: string
}

/** 6-digit code split as "123 456" — easier to read aloud, like the web client. */
function formatCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code
}

/**
 * TOTP code + countdown + copy, mirroring the web `TotpDisplay` (P17.4a).
 *
 * Two deliberate differences, both required by the mobile spec: the digits stay
 * masked (`••• •••`) until the card is revealed (single-reveal), and the code is
 * written LTR even in an Arabic layout so it is never reordered.
 */
export function TotpDisplayMobile({
  code,
  secondsRemaining,
  revealed,
  issuer,
}: TotpDisplayMobileProps) {
  const tokens = useTokens()
  const { t, isRTL } = useLocale()
  const [copied, setCopied] = useState(false)

  const percentage = Math.max(0, Math.min(100, Math.round((secondsRemaining / PERIOD) * 100)))
  const warning = secondsRemaining <= 5

  async function copy() {
    if (!code) return
    await Clipboard.setStringAsync(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <View style={{ gap: tokens.space[2] }}>
      {code === null ? (
        <View
          accessible={false}
          style={{
            width: 120,
            height: 30,
            borderRadius: tokens.radius.sm,
            backgroundColor: tokens.c.surface2,
          }}
        />
      ) : (
        <Text
          // The digits themselves are only announced once revealed.
          accessibilityLabel={revealed ? formatCode(code) : t("twofa.hide")}
          maxFontSizeMultiplier={1.4}
          style={{
            color: tokens.c.textStrong,
            fontFamily: tokens.font.mono,
            fontSize: 28,
            fontWeight: "600",
            letterSpacing: 4,
            writingDirection: "ltr",
            textAlign: "left",
          }}
        >
          {revealed ? formatCode(code) : "••• •••"}
        </Text>
      )}

      <View
        accessible={false}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: PERIOD, now: secondsRemaining }}
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          height: 6,
          borderRadius: 999,
          overflow: "hidden",
          backgroundColor: tokens.c.border,
        }}
      >
        <View
          style={{
            width: `${percentage}%`,
            height: "100%",
            backgroundColor: warning ? tokens.c.warning : tokens.c.brand,
          }}
        />
      </View>

      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: tokens.space[3],
        }}
      >
        <Text
          style={{
            color: warning ? tokens.c.warning : tokens.c.muted,
            fontSize: tokens.size["2xs"],
          }}
        >
          {t("twofa.expires_in", { seconds: secondsRemaining })}
        </Text>

        {code ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("twofa.copy.aria", { issuer })}
            onPress={() => void copy()}
            style={{
              paddingHorizontal: tokens.space[3],
              paddingVertical: tokens.space[1],
              borderRadius: tokens.radius.sm,
              borderWidth: 1,
              borderColor: tokens.c.borderStrong,
            }}
          >
            <Text style={{ color: tokens.c.text, fontSize: tokens.size.xs }}>
              {copied ? t("twofa.copied") : t("twofa.copy")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
