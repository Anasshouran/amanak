import { useState } from "react"
import { Pressable, ScrollView, Text, TextInput, View } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import {
  MAX_LENGTH,
  MIN_LENGTH,
  defaultGeneratorOptions,
  generatePassword,
  type PasswordGeneratorOptions,
} from "../../lib/vault/generator"
import { useLocale } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"

const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl"]

function hasSequence(lower: string): boolean {
  for (const sequence of SEQUENCES) {
    for (let i = 0; i + 3 <= sequence.length; i++) {
      if (lower.includes(sequence.slice(i, i + 3))) return true
    }
  }
  return false
}

function countRuns(password: string): number {
  let runs = 0
  let run = 1
  for (let i = 1; i < password.length; i++) {
    if (password[i] === password[i - 1]) {
      run += 1
      if (run === 3) runs += 1
    } else {
      run = 1
    }
  }
  return runs
}

/** UI-only strength hint (0–100), never a security control. */
function scorePassword(password: string): number {
  if (!password) return 0
  let score = Math.min(45, password.length * 3)
  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length
  score += (classes - 1) * 12
  score += Math.min(20, new Set(password).size * 2)
  const lower = password.toLowerCase()
  if (/password|qwerty|123456|admin|letmein|welcome/.test(lower)) score -= 30
  if (hasSequence(lower)) score -= 10
  score -= countRuns(password) * 8
  return Math.max(0, Math.min(100, Math.round(score)))
}

type StrengthLabel = "weak" | "fair" | "good" | "strong"
function strengthLabel(score: number): StrengthLabel {
  if (score < 40) return "weak"
  if (score < 60) return "fair"
  if (score < 80) return "good"
  return "strong"
}

export type GeneratorPanelProps = {
  value: string
  onChange: (password: string) => void
  options: PasswordGeneratorOptions
  onOptionsChange: (options: PasswordGeneratorOptions) => void
}

/**
 * Password generator panel — web `passwords.gen.*` parity rendered mobile.
 *
 * Length slider (12–64), character-set toggles and a strength meter. The
 * actual generation delegates to `lib/vault/generator` (untouched).
 */
export function GeneratorPanel({ value, onChange, options, onOptionsChange }: GeneratorPanelProps) {
  const tokens = useTokens()
  const { t } = useLocale()
  const [genOpen, setGenOpen] = useState(true)

  const score = scorePassword(value)
  const strength = strengthLabel(score)

  function applyGenerated() {
    try {
      onChange(generatePassword(options))
    } catch {
      /* at least one character set must be enabled */
    }
  }

  const toggle = (key: keyof PasswordGeneratorOptions) => {
    onOptionsChange({ ...options, [key]: !options[key] })
  }

  return (
    <View style={{ gap: tokens.space[3] }}>
      <Pressable accessibilityRole="button" onPress={() => setGenOpen((open) => !open)} style={{ padding: tokens.space[1] }}>
        <Ionicons name={genOpen ? "chevron-up-outline" : "chevron-down-outline"} size={18} color={tokens.c.muted} />
      </Pressable>

      {genOpen ? (
        <View style={{ gap: tokens.space[3] }}>
          <Text style={{ color: tokens.c.textStrong, fontWeight: "700" }}>{t("passwords.gen.title")}</Text>

          <View style={{ gap: tokens.space[1] }}>
            <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs }}>{t("passwords.gen.length")}: {options.length}</Text>
            <TextInput
              keyboardType="numeric"
              maxLength={2}
              style={{
                backgroundColor: tokens.c.surface2,
                borderWidth: 1,
                borderColor: tokens.c.border,
                borderRadius: tokens.radius.md,
                color: tokens.c.text,
                fontSize: tokens.size.md,
                paddingHorizontal: tokens.space[3],
                paddingVertical: tokens.space[2],
                width: 64,
              }}
              value={String(options.length)}
              onChangeText={(text) => {
                const n = Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, Number(text) || MIN_LENGTH))
                onOptionsChange({ ...options, length: n })
              }}
            />
          </View>

          <View style={{ gap: tokens.space[2], flexDirection: "row", flexWrap: "wrap" }}>
            {[
              { key: "lower", label: t("passwords.gen.lower") },
              { key: "upper", label: t("passwords.gen.upper") },
              { key: "digits", label: t("passwords.gen.digits") },
              { key: "symbols", label: t("passwords.gen.symbols") },
            ].map(({ key, label }) => {
              const active = options[key as keyof PasswordGeneratorOptions]
              return (
                <Pressable
                  key={key}
                  onPress={() => toggle(key as keyof PasswordGeneratorOptions)}
                  style={{ flex: 1, alignItems: "center", gap: tokens.space[1], paddingVertical: tokens.space[2] }}
                >
                  <Ionicons name={active ? "checkbox-outline" : "square-outline"} size={18} color={active ? tokens.c.brand : tokens.c.muted} />
                  <Text style={{ color: active ? tokens.c.textStrong : tokens.c.muted, fontSize: tokens.size.sm }}>{label}</Text>
                </Pressable>
              )
            })}
          </View>

          <View style={{ gap: tokens.space[2] }}>
            <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs }}>{t("passwords.strength.label")}</Text>
            <View
              style={{
                backgroundColor: tokens.c.surface2,
                borderWidth: 1,
                borderColor: tokens.c.border,
                borderRadius: tokens.radius.md,
                overflow: "hidden",
                height: 8,
              }}
            >
              <View
                style={{
                  backgroundColor:
                    strength === "weak" ? tokens.c.danger : strength === "fair" ? tokens.c.warning : strength === "good" ? tokens.c.info : tokens.c.success,
                  height: 8,
                  width: `${score}%`,
                }}
              />
            </View>
            <Text style={{ color: tokens.c.muted, fontSize: tokens.size.xs, textAlign: "right" }}>
              {t(`passwords.strength.${strength}`)} · {score}/100
            </Text>
          </View>

          <Pressable accessibilityRole="button" onPress={applyGenerated} style={{ backgroundColor: tokens.c.brand, borderRadius: tokens.radius.md, paddingVertical: tokens.space[3], alignItems: "center" }}>
            <Text style={{ color: tokens.c.brandContrast, fontWeight: "700" }}>{t("passwords.gen.generate")}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}
