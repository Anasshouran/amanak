import { Pressable, Text, View } from "react-native"
import type { ScanMatch, ScanVerdict } from "@amanak/shared-types"
import { useLocale } from "../../design/LocaleProvider"
import { useTokens, type SemanticColors } from "../../design/tokens"

/**
 * Render model for a scan outcome.
 *
 * Mirrors the web view model: a fresh scan uses the response fields, while a
 * history item supplies `preview`/`created_at` instead.
 */
export type ScanResultView = {
  verdict: ScanVerdict
  score: number
  matches: ScanMatch[]
  rulesetVersion: string
  /** Raw input (fresh scan) or the redacted preview (history item). */
  input: string
  scannedAt: string
}

export type ScanResultProps = {
  /** Null while idle — the card renders nothing at all. */
  result: ScanResultView | null
  /** Skeleton state, matching the web `scan-result-skeleton`. */
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  onScanAnother?: () => void
  onCopyReport?: () => void
  onReportFalsePositive?: () => void
  /** True briefly after "Copy report" so the button can confirm. */
  copied?: boolean
}

type Verdict = ScanVerdict

function verdictColor(verdict: Verdict, c: SemanticColors): string {
  if (verdict === "safe") return c.success
  if (verdict === "suspicious") return c.warning
  return c.danger
}

function severityColor(severity: ScanMatch["severity"], c: SemanticColors): string {
  if (severity === "low") return c.sevLow
  if (severity === "medium") return c.sevMedium
  if (severity === "high") return c.sevHigh
  return c.sevCritical
}

/** Risk level shown in the details grid — mirrors the web mapping. */
function riskLevelOf(verdict: Verdict): ScanMatch["severity"] {
  if (verdict === "safe") return "low"
  if (verdict === "suspicious") return "medium"
  return "high"
}

function domainOf(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    const host = new URL(hasScheme ? trimmed : `https://${trimmed}`).hostname
    return host || null
  } catch {
    return null
  }
}

/** Tinted pill. 8-digit hex avoids needing a colour-mix helper. */
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: `${color}22` }}>
      <Text style={{ color, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  )
}

function Skeleton({ height }: { height: number }) {
  const tokens = useTokens()
  return (
    <View
      style={{
        height,
        borderRadius: tokens.radius.md,
        backgroundColor: tokens.c.surface2,
        borderWidth: 1,
        borderColor: tokens.c.border,
      }}
    />
  )
}

/**
 * Result card mirroring the web `ScanResult` (P17.3).
 *
 * One card with a verdict-coloured accent, status icon, badge, details grid,
 * indicators and the action row. Loading renders the skeleton the web client
 * shows while the scan is in flight, and a failed scan renders the retry state.
 */
export function ScanResult({
  result,
  loading = false,
  error,
  onRetry,
  onScanAnother,
  onCopyReport,
  onReportFalsePositive,
  copied = false,
}: ScanResultProps) {
  const tokens = useTokens()
  const { t, isRTL } = useLocale()
  const align: "right" | "left" = isRTL ? "right" : "left"

  // Shared style objects — the same box/button/label shapes recur across the
  // three states, so they are built once per render.
  const S = {
    card: {
      backgroundColor: tokens.c.elevated,
      borderRadius: tokens.radius.lg,
      borderWidth: 1,
      borderColor: tokens.c.border,
      padding: tokens.space[4],
    },
    title: { color: tokens.c.textStrong, fontSize: tokens.size.lg, fontWeight: "700" as const, textAlign: align },
    sub: { color: tokens.c.muted, fontSize: tokens.size.sm, textAlign: align },
    muted: { color: tokens.c.muted, textAlign: align },
    text: { color: tokens.c.text },
    label: { color: tokens.c.muted, fontSize: 12, textTransform: "uppercase" as const, letterSpacing: 0.6, textAlign: align },
    row: { flexDirection: isRTL ? ("row-reverse" as const) : ("row" as const), alignItems: "center" as const, gap: tokens.space[3] },
    btn: {
      paddingHorizontal: tokens.space[4],
      paddingVertical: tokens.space[2],
      borderRadius: tokens.radius.md,
      borderWidth: 1,
      borderColor: tokens.c.borderStrong,
    },
  }

  if (loading) {
    return (
      <View accessible={false} testID="scan-result-loading" style={{ ...S.card, gap: tokens.space[3] }}>
        <Skeleton height={20} />
        <Skeleton height={96} />
        <Skeleton height={64} />
        <Skeleton height={40} />
      </View>
    )
  }

  if (error) {
    return (
      <View accessibilityRole="alert" style={{ ...S.card, gap: tokens.space[3] }}>
        <Text style={{ color: tokens.c.danger, fontWeight: "700", textAlign: align }}>
          {t("common.error")}
        </Text>
        <Text style={S.muted}>{error}</Text>
        {onRetry ? (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={{ ...S.btn, alignSelf: isRTL ? "flex-end" : "flex-start" }}
          >
            <Text style={S.text}>{t("scanner.action.tryAgain")}</Text>
          </Pressable>
        ) : null}
      </View>
    )
  }

  if (!result) return null

  const verdict = result.verdict
  // "dangerous" is titled "Malicious" in the status block but badged
  // "Dangerous" — the same split the web client uses.
  const statusKey = verdict === "dangerous" ? "dangerous" : verdict
  const color = verdictColor(verdict, tokens.c)
  const risk = riskLevelOf(verdict)
  const domain = domainOf(result.input)

  return (
    <View
      accessibilityRole="summary"
      style={{ ...S.card, borderStartWidth: 4, borderStartColor: color, gap: tokens.space[4] }}
    >
      <View style={S.row}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: tokens.radius.md,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: `${color}22`,
          }}
        >
          <Text style={{ color, fontSize: 24, fontWeight: "700" }}>
            {verdict === "safe" ? "✓" : verdict === "suspicious" ? "!" : "✕"}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={S.title}>{t(`scanner.status.${statusKey}`)}</Text>
          <Text style={S.sub}>{t(`scanner.result.subtitle.${statusKey}`)}</Text>
        </View>
        <Badge label={t(`scanner.verdict.${verdict}`)} color={color} />
      </View>

      <View style={{ gap: tokens.space[3] }}>
        {[
          { label: t("scanner.result.details.url"), value: result.input, mono: true },
          {
            label: t("scanner.result.details.domain"),
            value: domain ?? t("scanner.result.domainUnknown"),
            mono: true,
          },
          { label: t("scanner.result.details.category"), value: t("scanner.result.notEnoughData"), mono: false },
        ].map((row) => (
          <View key={row.label} style={{ gap: 2 }}>
            <Text style={S.label}>{row.label}</Text>
            <Text
              style={{
                color: tokens.c.text,
                textAlign: align,
                writingDirection: row.mono ? "ltr" : isRTL ? "rtl" : "ltr",
              }}
            >
              {row.value}
            </Text>
          </View>
        ))}

        <View style={{ gap: 2 }}>
          <Text style={S.label}>{t("scanner.result.details.riskLevel")}</Text>
          <Badge label={t(`scanner.severity.${risk}`)} color={severityColor(risk, tokens.c)} />
        </View>
      </View>

      <View style={{ gap: tokens.space[2] }}>
        <Text style={{ color: tokens.c.textStrong, fontWeight: "700", textAlign: align }}>
          {t("scanner.result.details.indicators")}
        </Text>
        {result.matches.length === 0 ? (
          <Text style={S.muted}>{t("scanner.noMatches")}</Text>
        ) : (
          result.matches.map((match, index) => (
            <View
              key={`${match.rule_id}-${index}`}
              style={{
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: tokens.c.border,
                paddingTop: index === 0 ? 0 : tokens.space[3],
                gap: 4,
              }}
            >
              <View style={{ ...S.row, gap: tokens.space[2], flexWrap: "wrap" }}>
                <Text style={{ color: tokens.c.text, fontWeight: "600", writingDirection: "ltr" }}>
                  {t("scanner.match.rule")}: {match.rule_id}
                </Text>
                <Badge
                  label={t(`scanner.severity.${match.severity}`)}
                  color={severityColor(match.severity, tokens.c)}
                />
              </View>
              <Text style={S.muted}>{match.description}</Text>
            </View>
          ))
        )}
      </View>

      <View
        style={{
          flexDirection: isRTL ? "row-reverse" : "row",
          flexWrap: "wrap",
          justifyContent: "flex-end",
          gap: tokens.space[2],
        }}
      >
        {onScanAnother ? (
          <Pressable accessibilityRole="button" onPress={onScanAnother} style={S.btn}>
            <Text style={S.text}>{t("scanner.action.scanAnother")}</Text>
          </Pressable>
        ) : null}

        {onCopyReport ? (
          <Pressable accessibilityRole="button" onPress={onCopyReport} style={S.btn}>
            <Text style={S.text}>
              {copied ? t("actions.copied") : t("scanner.action.copyReport")}
            </Text>
          </Pressable>
        ) : null}

        {verdict !== "safe" && onReportFalsePositive ? (
          <Pressable accessibilityRole="button" onPress={onReportFalsePositive}>
            <Text style={{ ...S.muted, paddingVertical: tokens.space[2] }}>
              {t("scanner.action.reportFalsePositive")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
