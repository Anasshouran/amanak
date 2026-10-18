import { useEffect, useState } from "react"
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { PasswordEntry } from "@amanak/shared-types"
import { PASSWORD_CATEGORIES } from "@amanak/shared-types"
import { defaultGeneratorOptions, type PasswordGeneratorOptions } from "../../lib/vault/generator"
import { GeneratorPanel } from "./GeneratorPanel"
import { useLocale } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"

const MOBILE_CATEGORIES = ["all", "email", "banking", "social", "work", "other"] as const

export type EntryModalMobileProps = {
  open: boolean
  mode: "add" | "edit"
  initialTitle?: string
  initialUsername?: string
  initialPassword?: string
  initialUrl?: string
  initialNotes?: string
  initialCategory?: string
  busy?: boolean
  error?: string | null
  onClose: () => void
  onSave: (values: {
    title: string
    username: string
    password: string
    url: string
    notes: string
    category: string
  }) => void
}

/**
 * Add / edit entry modal — web `EntryModal` parity rendered mobile.
 *
 * Fields: title, username, password, url, category, notes plus an inline
 * password generator with strength meter. Encryption is performed by the
 * screen (it holds `vaultKey`); this modal only collects values.
 */
export function EntryModalMobile({
  open,
  mode,
  initialTitle = "",
  initialUsername = "",
  initialPassword = "",
  initialUrl = "",
  initialNotes = "",
  initialCategory = "other",
  busy = false,
  error = null,
  onClose,
  onSave,
}: EntryModalMobileProps) {
  const tokens = useTokens()
  const { t } = useLocale()
  const [title, setTitle] = useState(initialTitle)
  const [username, setUsername] = useState(initialUsername)
  const [password, setPassword] = useState(initialPassword)
  const [url, setUrl] = useState(initialUrl)
  const [notes, setNotes] = useState(initialNotes)
  const [category, setCategory] = useState(initialCategory)
  const [gen, setGen] = useState<PasswordGeneratorOptions>(defaultGeneratorOptions())

  useEffect(() => {
    if (open) {
      setTitle(initialTitle)
      setUsername(initialUsername)
      setPassword(initialPassword)
      setUrl(initialUrl)
      setNotes(initialNotes)
      setCategory(initialCategory)
      setGen(defaultGeneratorOptions())
    }
  }, [open, initialTitle, initialUsername, initialPassword, initialUrl, initialNotes, initialCategory])

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(2,6,23,0.4)", justifyContent: "center", padding: tokens.space[4] }}>
        <View style={{ backgroundColor: tokens.c.elevated, borderRadius: tokens.radius.lg, borderWidth: 1, borderColor: tokens.c.border, padding: tokens.space[5], gap: tokens.space[3], maxHeight: "90%" }}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: tokens.space[3] }}>
            <Text style={{ color: tokens.c.textStrong, fontWeight: "700", fontSize: tokens.size.lg }}>
              {mode === "add" ? t("vault.add_entry") : t("vault.edit_entry")}
            </Text>

            <View style={{ gap: tokens.space[1] }}>
              <Text style={{ color: tokens.c.muted, fontSize: tokens.size.sm }}>{t("passwords.field.title")}</Text>
              <TextInput
                placeholder={t("common.none")}
                value={title}
                onChangeText={setTitle}
                style={inputStyle()}
              />
            </View>

            <View style={{ gap: tokens.space[1] }}>
              <Text style={{ color: tokens.c.muted, fontSize: tokens.size.sm }}>{t("passwords.field.username")}</Text>
              <TextInput
                placeholder=""
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                style={inputStyle()}
              />
            </View>

            <View style={{ gap: tokens.space[1] }}>
              <Text style={{ color: tokens.c.muted, fontSize: tokens.size.sm }}>{t("passwords.field.password")}</Text>
              <GeneratorPanel value={password} onChange={setPassword} options={gen} onOptionsChange={setGen} />
            </View>

            <View style={{ gap: tokens.space[1] }}>
              <Text style={{ color: tokens.c.muted, fontSize: tokens.size.sm }}>{t("passwords.field.url")}</Text>
              <TextInput
                placeholder=""
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                style={inputStyle()}
              />
            </View>

            <View style={{ gap: tokens.space[1] }}>
              <Text style={{ color: tokens.c.muted, fontSize: tokens.size.sm }}>{t("passwords.field.category")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space[1] }}>
                {MOBILE_CATEGORIES.slice(1).map((cat) => {
                  const active = category === cat
                  return (
                    <Pressable key={cat} onPress={() => setCategory(cat)} style={chipStyle(active)}>
                      <Text style={{ color: active ? tokens.c.brandContrast : tokens.c.text, fontSize: tokens.size.sm, fontWeight: "600" }}>
                        {t(`vault.category.${cat}`)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>

            <View style={{ gap: tokens.space[1] }}>
              <Text style={{ color: tokens.c.muted, fontSize: tokens.size.sm }}>{t("passwords.field.notes")}</Text>
              <TextInput
                placeholder=""
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                style={{ ...inputStyle(), minHeight: 80 }}
              />
            </View>

            {error && (
              <Text accessibilityRole="alert" style={{ color: tokens.c.danger, fontSize: tokens.size.sm }}>
                {error}
              </Text>
            )}

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: tokens.space[2], marginTop: tokens.space[1] }}>
              <Pressable accessibilityRole="button" onPress={onClose} style={{ padding: tokens.space[2] }}>
                <Text style={{ color: tokens.c.muted }}>{t("actions.cancel")}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() =>
                  onSave({
                    title: title.trim(),
                    username: username.trim(),
                    password,
                    url: url.trim(),
                    notes: notes.trim(),
                    category,
                  })
                }
                style={{
                  backgroundColor: tokens.c.brand,
                  borderRadius: tokens.radius.md,
                  paddingHorizontal: tokens.space[5],
                  paddingVertical: tokens.space[3],
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Text style={{ color: tokens.c.brandContrast, fontWeight: "700" }}>
                  {mode === "add" ? t("vault.save_add") : t("actions.save")}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )

  function inputStyle() {
    return {
      backgroundColor: tokens.c.surface2,
      borderWidth: 1,
      borderColor: tokens.c.border,
      borderRadius: tokens.radius.md,
      paddingHorizontal: tokens.space[3],
      paddingVertical: tokens.space[2],
      color: tokens.c.text,
    }
  }

  function chipStyle(active: boolean) {
    return {
      backgroundColor: active ? tokens.c.brand : tokens.c.surface2,
      borderRadius: tokens.radius.md,
      paddingHorizontal: tokens.space[3],
      paddingVertical: tokens.space[1],
    }
  }
}
