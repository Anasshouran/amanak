import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native"
import type { TwoFactorEntry } from "@amanak/shared-types"
import { api } from "../../lib/api"
import { b64Decode } from "../../lib/vault/bytes"
import { generateTotp, totpSecondsRemaining } from "../../lib/vault/totp"
import { aadFromEntryId, decryptWithIv } from "../../lib/vault/vault"
import { useLocale } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"
import { TwoFactorCard } from "./TwoFactorCard"

const AUTO_LOCK_MS = 5 * 60 * 1000

export type TwoFactorListMobileProps = {
  /** Derived master key — held in React state by the screen, never persisted. */
  vaultKey: Uint8Array
  /** Manual "Lock" button. */
  onLock: () => void
  /** Idle timeout fired (the screen shows the `2fa.autoLocked` notice). */
  onAutoLock: () => void
  onVaultDeleted: () => void
  onAdd: () => void
  onEdit: (entry: TwoFactorEntry) => void
  /** Bumped by the screen after the add/edit modal saves. */
  refreshToken?: number
}

function messageOf(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message
  }
  return fallback
}

type Tab = "apps" | "backup"

/**
 * Unlocked 2FA list — the mobile counterpart of the web `TwoFactorList`.
 *
 * Same data path as the previous mobile screen (server-blind blobs, decrypted
 * locally with the derived key, codes recomputed every second), restyled onto
 * the P17 design tokens and re-shaped into cards. Web renders the codes in a
 * table; here each entry is a card with a single-reveal TOTP block.
 */
export function TwoFactorListMobile({
  vaultKey,
  onLock,
  onAutoLock,
  onVaultDeleted,
  onAdd,
  onEdit,
  refreshToken = 0,
}: TwoFactorListMobileProps) {
  const tokens = useTokens()
  const { t, isRTL } = useLocale()

  const [entries, setEntries] = useState<TwoFactorEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [revealedId, setRevealedId] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>("apps")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setEntries(await api.listTwoFactorEntries())
    } catch (err) {
      setError(messageOf(err, t("common.error")))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  // Codes rotate every 30 s; ticking every second also drives the countdown.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Auto-lock after 5 minutes without interaction — unchanged from the P8 screen.
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pokeRef = useRef<() => void>(() => {})
  useEffect(() => {
    pokeRef.current = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(onAutoLock, AUTO_LOCK_MS)
    }
    pokeRef.current()
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [onAutoLock])

  const decrypted = useMemo(
    () =>
      entries.map((entry) => {
        try {
          const secret = decryptWithIv(
            vaultKey,
            b64Decode(entry.ciphertext),
            b64Decode(entry.iv),
            aadFromEntryId(entry.id),
          )
          return { entry, code: generateTotp(secret, now) }
        } catch {
          return { entry, code: null }
        }
      }),
    [entries, vaultKey, now],
  )

  function confirmDelete(entry: TwoFactorEntry) {
    Alert.alert(
      t("twofa.delete_entry.confirm_title"),
      `${t("twofa.delete_entry.confirm_body")}\n\n${entry.label}`,
      [
        { text: t("actions.cancel"), style: "cancel" },
        {
          text: t("actions.delete"),
          style: "destructive",
          onPress: () => {
            void api
              .deleteTwoFactorEntry(entry.id)
              .then(() => {
                setRevealedId((current) => (current === entry.id ? null : current))
                return load()
              })
              .catch((err) => setError(messageOf(err, t("common.error"))))
          },
        },
      ],
    )
  }

  function confirmDeleteVault() {
    Alert.alert(t("twofa.delete_vault.confirm_title"), t("twofa.delete_vault.confirm_body"), [
      { text: t("actions.cancel"), style: "cancel" },
      {
        text: t("actions.delete"),
        style: "destructive",
        onPress: () => {
          void api.deleteTwoFactorProfile().then(onVaultDeleted)
        },
      },
    ])
  }

  const align: "right" | "left" = isRTL ? "right" : "left"

  // One shared set of shapes for the repeated card / button / tab styles.
  const S = {
    row: { flexDirection: isRTL ? ("row-reverse" as const) : ("row" as const), alignItems: "center" as const, gap: tokens.space[3] },
    h1: { color: tokens.c.textStrong, fontSize: tokens.size.xl, fontWeight: "700" as const, textAlign: align },
    sub: { color: tokens.c.muted, fontSize: tokens.size.sm, textAlign: align },
    card: {
      backgroundColor: tokens.c.surface,
      borderRadius: tokens.radius.lg,
      borderWidth: 1,
      borderColor: tokens.c.border,
      padding: tokens.space[5],
      alignItems: "center" as const,
      gap: tokens.space[2],
    },
    cardTitle: { color: tokens.c.textStrong, fontWeight: "700" as const, textAlign: "center" as const },
    cardBody: { color: tokens.c.muted, fontSize: tokens.size.sm, textAlign: "center" as const },
    outlineBtn: {
      paddingHorizontal: tokens.space[3],
      paddingVertical: tokens.space[2],
      borderRadius: tokens.radius.md,
      borderWidth: 1,
      borderColor: tokens.c.borderStrong,
    },
    tablist: {
      flexDirection: isRTL ? ("row-reverse" as const) : ("row" as const),
      backgroundColor: tokens.c.surface2,
      borderRadius: tokens.radius.full,
      padding: 4,
      gap: 4,
    },
  }

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        pokeRef.current()
        return false
      }}
    >
      <ScrollView
        onScrollBeginDrag={() => pokeRef.current()}
        contentContainerStyle={{ padding: tokens.space[4], gap: tokens.space[3], paddingBottom: 48 }}
      >
        <View style={{ ...S.row, justifyContent: "space-between" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={S.h1}>{t("twofa.title")}</Text>
            <Text style={S.sub}>{t("twofa.subtitle")}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("2fa.lock")}
            onPress={onLock}
            style={S.outlineBtn}
          >
            <Text style={{ color: tokens.c.text, fontWeight: "600" }}>{t("2fa.lock")}</Text>
          </Pressable>
        </View>

        <View accessibilityRole="tablist" style={S.tablist}>
          {(["apps", "backup"] as Tab[]).map((value) => {
            const selected = value === tab
            return (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setTab(value)}
                style={{
                  flex: 1,
                  paddingVertical: tokens.space[3],
                  borderRadius: tokens.radius.full,
                  alignItems: "center",
                  backgroundColor: selected ? tokens.c.surface : "transparent",
                  borderWidth: 1,
                  borderColor: selected ? tokens.c.border : "transparent",
                }}
              >
                <Text
                  style={{
                    color: selected ? tokens.c.textStrong : tokens.c.muted,
                    fontWeight: "600",
                    fontSize: tokens.size.sm,
                  }}
                >
                  {value === "apps" ? t("twofa.tabs.apps") : t("twofa.tabs.backup")}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {tab === "backup" ? (
          <View style={S.card}>
            <Text style={S.cardTitle}>{t("twofa.backup.empty.title")}</Text>
            <Text style={S.cardBody}>{t("twofa.backup.empty.description")}</Text>
          </View>
        ) : (
          <>
            {loading ? <ActivityIndicator color={tokens.c.brand} /> : null}

            {error ? (
              <Text accessibilityRole="alert" style={{ color: tokens.c.danger, textAlign: align }}>
                {error}
              </Text>
            ) : null}

            {!loading && !error && entries.length === 0 ? (
              <View style={S.card}>
                <Text style={S.cardTitle}>{t("2fa.list.empty.title")}</Text>
                <Text style={S.cardBody}>{t("2fa.list.empty.description")}</Text>
              </View>
            ) : null}

            {decrypted.map(({ entry, code }) => (
              <TwoFactorCard
                key={entry.id}
                entry={entry}
                code={code}
                secondsRemaining={totpSecondsRemaining(now)}
                revealed={revealedId === entry.id}
                onToggleReveal={() =>
                  // Single-reveal: opening one card closes any other.
                  setRevealedId((current) => (current === entry.id ? null : entry.id))
                }
                onEdit={() => onEdit(entry)}
                onDelete={() => confirmDelete(entry)}
              />
            ))}

            <Pressable
              accessibilityRole="button"
              onPress={onAdd}
              style={{
                backgroundColor: tokens.c.brand,
                borderRadius: tokens.radius.md,
                paddingVertical: tokens.space[4],
                alignItems: "center",
              }}
            >
              <Text style={{ color: tokens.c.brandContrast, fontWeight: "700" }}>
                {t("2fa.addEntry")}
              </Text>
            </Pressable>

            <View
              style={{
                borderWidth: 1,
                borderColor: tokens.c.danger,
                borderRadius: tokens.radius.md,
                padding: tokens.space[4],
                gap: tokens.space[2],
              }}
            >
              <Text style={{ color: tokens.c.textStrong, fontWeight: "700", textAlign: align }}>
                {t("2fa.danger.title")}
              </Text>
              <Text style={S.sub}>{t("2fa.deleteVault.description")}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={confirmDeleteVault}
                style={{ paddingVertical: tokens.space[2] }}
              >
                <Text style={{ color: tokens.c.danger, fontWeight: "700", textAlign: align }}>
                  {t("twofa.delete_vault")}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}
