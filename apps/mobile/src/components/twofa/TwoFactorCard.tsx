import { useState } from "react"
import { Pressable, Text, View } from "react-native"
import type { TwoFactorEntry } from "@amanak/shared-types"
import { useLocale } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"
import { TotpDisplayMobile } from "./TotpDisplayMobile"

export type TwoFactorCardProps = {
  entry: TwoFactorEntry
  /** Null when the entry could not be decrypted. */
  code: string | null
  secondsRemaining: number
  revealed: boolean
  onToggleReveal: () => void
  onEdit: () => void
  onDelete: () => void
}

/** Deterministic avatar colour, same FNV-ish hash the web row uses. */
export function colorForSeed(seed: string): string {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360
  }
  return `hsl(${hash}, 70%, 40%)`
}

/**
 * One authenticator entry, mirroring the web `TwoFactorRow` (P17.4a) as a card:
 * avatar circle, issuer, label, the TOTP block and an actions menu.
 *
 * The spec asks for an overflow (ellipsis) menu where the web client shows two
 * flat icon buttons, so the menu is an inline popover with the same two actions.
 */
export function TwoFactorCard({
  entry,
  code,
  secondsRemaining,
  revealed,
  onToggleReveal,
  onEdit,
  onDelete,
}: TwoFactorCardProps) {
  const tokens = useTokens()
  const { t, isRTL } = useLocale()
  const [menuOpen, setMenuOpen] = useState(false)

  const title = entry.issuer || entry.label
  const initial = (title || "?").charAt(0).toUpperCase()
  const align: "right" | "left" = isRTL ? "right" : "left"

  // Shapes reused by the identity block, the menu rows and the card shell.
  const S = {
    card: {
      backgroundColor: tokens.c.elevated,
      borderRadius: tokens.radius.lg,
      borderWidth: 1,
      borderColor: tokens.c.border,
      padding: tokens.space[4],
      gap: tokens.space[3],
    },
    row: { flexDirection: isRTL ? ("row-reverse" as const) : ("row" as const), alignItems: "center" as const, gap: tokens.space[3] },
    name: { color: tokens.c.textStrong, fontWeight: "700" as const, textAlign: align },
    sub: { color: tokens.c.muted, fontSize: tokens.size.sm, textAlign: align },
    menuItem: { paddingVertical: tokens.space[2] },
  }

  return (
    <View style={S.card}>
      <View style={S.row}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colorForSeed(title),
          }}
        >
          <Text style={{ color: "#ffffff", fontWeight: "700" }}>{initial}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={revealed ? t("twofa.hide") : t("twofa.reveal")}
          onPress={onToggleReveal}
          style={{ flex: 1, gap: 2 }}
        >
          <Text numberOfLines={1} style={S.name}>
            {title}
          </Text>
          <Text numberOfLines={1} style={S.sub}>
            {entry.label}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("twofa.actions")}
          accessibilityState={{ expanded: menuOpen }}
          hitSlop={8}
          onPress={() => setMenuOpen((open) => !open)}
          style={{ paddingHorizontal: tokens.space[2], paddingVertical: tokens.space[1] }}
        >
          <Text style={{ color: tokens.c.muted, fontSize: 20, fontWeight: "700" }}>⋯</Text>
        </Pressable>
      </View>

      <TotpDisplayMobile
        code={code}
        secondsRemaining={secondsRemaining}
        revealed={revealed}
        issuer={title}
      />

      {code === null ? (
        <Text style={{ color: tokens.c.danger, fontSize: tokens.size.sm }}>
          {t("2fa.add.err.invalid")}
        </Text>
      ) : null}

      {menuOpen ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: tokens.c.border,
            paddingTop: tokens.space[2],
            gap: tokens.space[1],
          }}
        >
          <Pressable
            accessibilityRole="menuitem"
            onPress={() => {
              setMenuOpen(false)
              onEdit()
            }}
            style={S.menuItem}
          >
            <Text style={{ color: tokens.c.text, textAlign: align }}>{t("actions.edit")}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="menuitem"
            onPress={() => {
              setMenuOpen(false)
              onDelete()
            }}
            style={S.menuItem}
          >
            <Text style={{ color: tokens.c.danger, textAlign: align }}>{t("actions.delete")}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}
