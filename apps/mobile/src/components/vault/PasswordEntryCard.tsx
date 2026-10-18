import { useEffect, useRef, useState } from "react"
import { Pressable, Text, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Clipboard from "expo-clipboard"
import type { PasswordEntry } from "@amanak/shared-types"
import { useLocale } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"

function getColorForString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 40%)`
}

function getHostname(url: string | undefined | null): string {
  if (!url) return ""
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export type PasswordEntryCardProps = {
  entry: PasswordEntry
  /** Plaintext password while revealed; null otherwise. */
  password: string | null
  revealed: boolean
  onReveal: () => void
  onMask: () => void
  onEdit: () => void
  onDelete: () => void
  /** Resolves the plaintext to copy (decrypts on demand when masked). */
  onCopy: () => Promise<string>
}

/**
 * One password entry card — web `PasswordEntryRow` parity rendered mobile.
 *
 * Shows a deterministic avatar circle, title/username/hostname, the masked
 * (or revealed) password, a 10 s reveal countdown, copy via expo-clipboard
 * and an ellipsis menu with Edit / Delete.
 */
export function PasswordEntryCard({
  entry,
  password,
  revealed,
  onReveal,
  onMask,
  onEdit,
  onDelete,
  onCopy,
}: PasswordEntryCardProps) {
  const tokens = useTokens()
  const { t, isRTL } = useLocale()
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const displayTitle = entry.title || entry.username || t("common.none")
  const firstChar = displayTitle ? displayTitle.charAt(0).toUpperCase() : "?"
  const masked = "••••••••"
  const hostname = getHostname(entry.url)
  const align: "left" | "right" = isRTL ? "right" : "left"

  // Clear the clipboard after 30 s (best effort) and always on unmount so a
  // revealed password never lingers in the pasteboard.
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current)
        copyTimerRef.current = null
      }
    }
  }, [])

  async function handleCopy() {
    try {
      const value = await onCopy()
      await Clipboard.setStringAsync(value)
      setCopied(true)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(async () => {
        try {
          await Clipboard.setStringAsync("")
        } catch {
          /* best effort */
        }
        copyTimerRef.current = null
      }, 30_000)
      setTimeout(() => setCopied(false), 3_000)
    } catch {
      /* best effort */
    }
  }

  return (
    <View
      style={{
        backgroundColor: tokens.c.surface,
        borderRadius: tokens.radius.lg,
        borderWidth: 1,
        borderColor: tokens.c.border,
        padding: tokens.space[4],
        gap: tokens.space[3],
        flexDirection: isRTL ? "row-reverse" : "row",
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: getColorForString(displayTitle),
        }}
      >
        <Text style={{ color: "#ffffff", fontWeight: "700" }}>{firstChar}</Text>
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            color: tokens.c.textStrong,
            fontWeight: "700",
            fontSize: tokens.size.md,
            textAlign: align,
            writingDirection: isRTL ? "rtl" : "ltr",
          }}
        >
          {displayTitle}
        </Text>
        {entry.username && (
          <Text
            numberOfLines={1}
            style={{
              color: tokens.c.muted,
              fontSize: tokens.size.sm,
              fontFamily: tokens.font.mono,
              textAlign: align,
              writingDirection: "ltr",
            }}
          >
            {entry.username}
          </Text>
        )}
        {hostname && (
          <Text
            numberOfLines={1}
            style={{
              color: tokens.c.muted,
              fontSize: tokens.size.xs,
              textAlign: align,
              writingDirection: "ltr",
            }}
          >
            {hostname}
          </Text>
        )}
      </View>

      <View style={{ gap: tokens.space[2] }}>
        <View
          style={{
            flexDirection: isRTL ? "row-reverse" : "row",
            alignItems: "center",
            gap: tokens.space[2],
          }}
        >
          <Text
            accessibilityLabel={t("vault.password.aria", {
              title: displayTitle,
              state: revealed ? t("vault.state.revealed") : t("vault.state.masked"),
            })}
            data-testid={revealed ? "password-revealed" : "password-masked"}
            style={{
              color: tokens.c.text,
              fontSize: tokens.size.md,
              fontWeight: "700",
              fontFamily: tokens.font.mono,
              writingDirection: "ltr",
              minWidth: 96,
              textAlign: align,
            }}
          >
            {revealed ? (password ?? "") : masked}
          </Text>

          {revealed ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("vault.hide_password", { title: displayTitle })}
              onPress={onMask}
              style={{ padding: tokens.space[1] }}
            >
              <Ionicons name="eye-off-outline" size={16} color={tokens.c.muted} />
              <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs }}>{t("vault.hide")}</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("vault.reveal_password", { title: displayTitle })}
              onPress={onReveal}
              style={{ padding: tokens.space[1] }}
            >
              <Ionicons name="eye-outline" size={16} color={tokens.c.muted} />
              <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs }}>{t("vault.reveal")}</Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("vault.copy_password", { title: displayTitle })}
            onPress={handleCopy}
            style={{ padding: tokens.space[1] }}
          >
            <Ionicons name="copy-outline" size={16} color={tokens.c.muted} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("twofa.actions")}
            onPress={() => setMenuOpen((open) => !open)}
            style={{ padding: tokens.space[1] }}
          >
            <Ionicons name="ellipsis-vertical-outline" size={18} color={tokens.c.muted} />
          </Pressable>
        </View>

        {revealed && (
          <View
            style={{
              flexDirection: isRTL ? "row-reverse" : "row",
              justifyContent: isRTL ? "flex-end" : "flex-start",
              gap: tokens.space[1],
            }}
          >
            <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs }}>{t("vault.revealed_for", { seconds: "10" })}</Text>
          </View>
        )}

        {menuOpen ? (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: tokens.c.border,
              marginTop: tokens.space[2],
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
              style={{ paddingVertical: tokens.space[2] }}
            >
              <Text style={{ color: tokens.c.text, textAlign: align }}>{t("actions.edit")}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="menuitem"
              onPress={() => {
                setMenuOpen(false)
                onDelete()
              }}
              style={{ paddingVertical: tokens.space[2] }}
            >
              <Text style={{ color: tokens.c.danger, textAlign: align }}>{t("actions.delete")}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  )
}
