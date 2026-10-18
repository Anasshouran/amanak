import { useMemo, useState } from "react"
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { PasswordEntry } from "@amanak/shared-types"
import { useLocale } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"
import { PasswordEntryCard } from "./PasswordEntryCard"

const MOBILE_CATEGORIES = ["all", "email", "banking", "social", "work", "other"] as const

export type PasswordEntryListMobileProps = {
  entries: PasswordEntry[]
  loading?: boolean
  error?: unknown
  onAdd: () => void
  onEdit: (entry: PasswordEntry) => void
  onDelete: (entry: PasswordEntry) => void
  /** Decrypts one entry on demand; resolves to null when the vault is locked. */
  onRevealPassword: (entry: PasswordEntry) => Promise<string | null>
  /** Downloads an encrypted backup of the whole vault. */
  onExport?: () => void
  onReload?: () => void
}

/**
 * Password entry list — web `PasswordEntryList` parity rendered mobile.
 *
 * Toolbar: search input, horizontal-scroll category chips and a sort toggle.
 * Only one entry is revealed at a time; revealing another masks the previous.
 */
export function PasswordEntryListMobile({
  entries,
  loading = false,
  error,
  onAdd,
  onEdit,
  onDelete,
  onRevealPassword,
  onExport,
  onReload,
}: PasswordEntryListMobileProps) {
  const tokens = useTokens()
  const { t, isRTL } = useLocale()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<"all" | "email" | "banking" | "social" | "work" | "other">("all")
  const [sort, setSort] = useState<"updated" | "title">("updated")
  const [revealedId, setRevealedId] = useState<number | null>(null)
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null)
  const [revealFailed, setRevealFailed] = useState(false)

  const align: "left" | "right" = isRTL ? "right" : "left"

  const filtered = useMemo(() => {
    let rows = entries.slice()
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (entry) =>
          (entry.title ?? "").toLowerCase().includes(q) ||
          (entry.username ?? "").toLowerCase().includes(q) ||
          (entry.url ?? "").toLowerCase().includes(q),
      )
    }
    if (category !== "all") {
      rows = rows.filter((entry) => (entry.category ?? "other") === category)
    }
    if (sort === "title") {
      rows.sort((a, b) => (a.title || "").localeCompare(b.title || ""))
    } else {
      rows.sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())
    }
    return rows
  }, [entries, search, category, sort])

  function mask() {
    setRevealedId(null)
    setRevealedPassword(null)
  }

  async function reveal(entry: PasswordEntry) {
    try {
      const value = await onRevealPassword(entry)
      if (value === null) {
        setRevealFailed(true)
        return
      }
      setRevealFailed(false)
      setRevealedPassword(value)
      setRevealedId(entry.id)
    } catch {
      setRevealFailed(true)
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: tokens.space[4],
        gap: tokens.space[3],
        paddingBottom: tokens.space[12],
      }}
      keyboardShouldPersistTaps="handled"
    >
      {loading && entries.length === 0 ? (
        <View style={{ gap: tokens.space[2], alignItems: "center" }}>
          <Text style={{ color: tokens.c.muted }}>{t("common.loading")}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={{ gap: tokens.space[2], alignItems: "center" }}>
          <Text style={{ color: tokens.c.danger, textAlign: align }}>{String(error)}</Text>
          {onReload ? (
            <Pressable accessibilityRole="button" onPress={onReload} style={{ padding: tokens.space[2] }}>
              <Text style={{ color: tokens.c.brand, fontWeight: "600" }}>{t("actions.retry")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {entries.length === 0 ? (
        <View style={{ gap: tokens.space[3], alignItems: "center" }}>
          <Text style={{ color: tokens.c.textStrong, fontWeight: "700", textAlign: align }}>
            {t("vault.empty.title")}
          </Text>
          <Text style={{ color: tokens.c.muted, textAlign: align }}>{t("vault.empty.subtitle")}</Text>
          <Pressable accessibilityRole="button" onPress={onAdd} style={{ padding: tokens.space[2] }}>
            <Text style={{ color: tokens.c.brand, fontWeight: "700" }}>{t("vault.empty.cta")}</Text>
          </Pressable>
        </View>
      ) : null}

      {entries.length > 0 ? (
        <>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.space[3],
              paddingHorizontal: 0,
            }}
          >
            <View style={{ flex: 1, gap: tokens.space[1] }}>
              <Text
                style={{
                  color: tokens.c.muted,
                  fontSize: tokens.size.sm,
                  textAlign: align,
                  writingDirection: isRTL ? "rtl" : "ltr",
                }}
              >
                {t("vault.search")}
              </Text>
              <View
                style={{
                  backgroundColor: tokens.c.surface2,
                  borderWidth: 1,
                  borderColor: tokens.c.border,
                  borderRadius: tokens.radius.md,
                  paddingHorizontal: tokens.space[3],
                  paddingVertical: tokens.space[2],
                  flexDirection: "row",
                  alignItems: "center",
                  gap: tokens.space[2],
                }}
              >
                <Ionicons name="search-outline" size={16} color={tokens.c.muted} />
                <TextInput
                  placeholder={t("vault.search.placeholder")}
                  placeholderTextColor={tokens.c.muted}
                  style={{
                    color: tokens.c.text,
                    flex: 1,
                    fontSize: tokens.size.md,
                    textAlign: align,
                    writingDirection: isRTL ? "rtl" : "ltr",
                  }}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="done"
                  blurOnSubmit
                />
              </View>
            </View>

            <View
              style={{
                gap: tokens.space[2],
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: category === "all" }}
                onPress={() => setCategory("all")}
                style={{
                  backgroundColor: category === "all" ? tokens.c.brand : tokens.c.surface2,
                  borderRadius: tokens.radius.md,
                  paddingHorizontal: tokens.space[3],
                  paddingVertical: tokens.space[1],
                }}
              >
                <Text
                  style={{
                    color: category === "all" ? tokens.c.brandContrast : tokens.c.text,
                    fontSize: tokens.size.sm,
                    fontWeight: "600",
                  }}
                >
                  {t("vault.category.all")}
                </Text>
              </Pressable>
              {MOBILE_CATEGORIES.slice(1).map((cat) => (
                <Pressable
                  key={cat}
                  accessibilityRole="button"
                  accessibilityState={{ selected: category === cat }}
                  onPress={() => setCategory(cat)}
                  style={{
                    backgroundColor: category === cat ? tokens.c.brand : tokens.c.surface2,
                    borderRadius: tokens.radius.md,
                    paddingHorizontal: tokens.space[3],
                    paddingVertical: tokens.space[1],
                  }}
                >
                  <Text
                    style={{
                      color: category === cat ? tokens.c.brandContrast : tokens.c.text,
                      fontSize: tokens.size.sm,
                      fontWeight: "600",
                      writingDirection: isRTL ? "rtl" : "ltr",
                    }}
                  >
                    {t(`vault.category.${cat}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={{ gap: tokens.space[1] }}>
              <Text
                style={{
                  color: tokens.c.muted,
                  fontSize: tokens.size.sm,
                  textAlign: align,
                  writingDirection: isRTL ? "rtl" : "ltr",
                }}
              >
                {t("vault.sort")}
              </Text>
              <Pressable accessibilityRole="button" onPress={() => setSort((s) => (s === "updated" ? "title" : "updated"))}>
                <Text
                  style={{
                    color: tokens.c.text,
                    fontSize: tokens.size.md,
                    fontWeight: "600",
                    textAlign: align,
                    writingDirection: isRTL ? "rtl" : "ltr",
                  }}
                >
                  {sort === "updated" ? t("vault.sort.updated") : t("vault.sort.title")}
                </Text>
              </Pressable>
            </View>

            {onExport ? (
              <Pressable accessibilityRole="button" onPress={onExport} style={{ padding: tokens.space[2] }}>
                <Ionicons name="download-outline" size={18} color={tokens.c.muted} />
              </Pressable>
            ) : null}
          </View>

          {revealFailed ? (
            <Text accessibilityRole="alert" style={{ color: tokens.c.danger, textAlign: align }}>
              {t("passwords.revealFailed")}
            </Text>
          ) : null}

          <View style={{ gap: tokens.space[3] }}>
            {filtered.map((entry) => {
              const isRevealed = revealedId === entry.id
              return (
                <PasswordEntryCard
                  key={entry.id}
                  entry={entry}
                  password={isRevealed ? (revealedPassword ?? "") : null}
                  revealed={isRevealed}
                  onReveal={() => void reveal(entry)}
                  onMask={mask}
                  onEdit={() => onEdit(entry)}
                  onDelete={() => onDelete(entry)}
                  onCopy={async () => {
                    if (isRevealed) return revealedPassword ?? ""
                    return (await onRevealPassword(entry)) ?? ""
                  }}
                />
              )
            })}
          </View>
        </>
      ) : null}
    </ScrollView>
  )
}
