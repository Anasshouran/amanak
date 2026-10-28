import { useCallback, useEffect, useState } from "react"
import { ScrollView, Text, View } from "react-native"
import * as Clipboard from "expo-clipboard"
import type { ScanResponse, ScanResultRecord } from "@amanak/shared-types"
import { api } from "../../src/lib/api"
import { Header } from "../../src/components/Header"
import { ScanInput } from "../../src/components/scanner/ScanInput"
import { ScanResult, type ScanResultView } from "../../src/components/scanner/ScanResult"
import { ScanHistoryMobile } from "../../src/components/scanner/ScanHistoryMobile"
import { ScanTabs, type ScanKind } from "../../src/components/scanner/ScanTabs"
import { useLocale } from "../../src/design/LocaleProvider"
import { useTokens } from "../../src/design/tokens"

function messageOf(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message
  }
  return fallback
}

function fromResponse(kind: ScanKind, input: string, res: ScanResponse): ScanResultView {
  return {
    verdict: res.verdict,
    score: res.score,
    matches: res.matches,
    rulesetVersion: res.ruleset_version,
    input,
    scannedAt: res.scanned_at,
  }
}

/**
 * History rows only carry a redacted preview, so re-showing one rebuilds the
 * view model from the stored record — exactly what the web client does.
 */
function fromHistory(item: ScanResultRecord): ScanResultView {
  return {
    verdict: item.verdict,
    score: item.score,
    matches: item.matches,
    rulesetVersion: item.ruleset_version,
    input: item.preview,
    scannedAt: item.created_at,
  }
}

/** Plain-text report shared with the web "Copy report" action. */
function buildReport(view: ScanResultView, labels: {
  result: string
  url: string
  risk: string
}): string {
  const lines = [view.input, "", `${labels.result}: ${view.verdict}`, `${labels.url}: ${view.input}`, `${labels.risk}: ${view.verdict}`]
  for (const match of view.matches) {
    lines.push(`- ${match.rule_id} (${match.severity}): ${match.description}`)
  }
  return lines.join("\n")
}

/**
 * Scanner screen — P17.6b parity with the web P17.3 redesign.
 *
 * Same pieces in the same order: tabs, input card, result card (skeleton /
 * error / verdict), then the scan history — which sits *below* the result on
 * mobile instead of in a sidebar.
 */
export default function Scanner() {
  const tokens = useTokens()
  const { t, isRTL } = useLocale()

  const [kind, setKind] = useState<ScanKind>("url")
  const [value, setValue] = useState("")
  const [result, setResult] = useState<ScanResultView | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const [history, setHistory] = useState<ScanResultRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      setHistory(await api.scanHistory())
    } catch (err) {
      setHistoryError(messageOf(err, t("common.error")))
    } finally {
      setHistoryLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  async function scan() {
    const input = value.trim()
    if (!input || busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = kind === "url" ? await api.scanUrl(input) : await api.scanMessage(input)
      setResult(fromResponse(kind, input, res))
      void loadHistory()
    } catch (err) {
      setError(messageOf(err, t("common.error")))
    } finally {
      setBusy(false)
    }
  }

  function changeKind(next: ScanKind) {
    setKind(next)
    setValue("")
    setResult(null)
    setError(null)
    setNotice(null)
  }

  async function copyReport() {
    if (!result) return
    await Clipboard.setStringAsync(
      buildReport(result, {
        result: t("scanner.result.title"),
        url: t("scanner.result.details.url"),
        risk: t("scanner.result.details.riskLevel"),
      }),
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.c.bg }}>
      <Header title={t("scanner.title")} />
      <ScrollView
        contentContainerStyle={{ padding: tokens.space[4], gap: tokens.space[4], paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          style={{
            color: tokens.c.muted,
            fontSize: tokens.size.sm,
            textAlign: isRTL ? "right" : "left",
            writingDirection: isRTL ? "rtl" : "ltr",
          }}
        >
          {t("scanner.subtitle")}
        </Text>

        <ScanTabs value={kind} onChange={changeKind} />

        <View
          style={{
            backgroundColor: tokens.c.elevated,
            borderRadius: tokens.radius.lg,
            borderWidth: 1,
            borderColor: tokens.c.border,
            padding: tokens.space[4],
          }}
        >
          <ScanInput
            kind={kind}
            value={value}
            onChange={setValue}
            onSubmit={() => void scan()}
            busy={busy}
            error={error}
          />
        </View>

        {/* Skeleton / retry are rendered by the result card itself. */}
        <ScanResult
          result={result}
          loading={busy}
          error={busy ? null : error}
          onRetry={() => void scan()}
          onScanAnother={() => {
            setResult(null)
            setValue("")
            setError(null)
            setNotice(null)
          }}
          onCopyReport={result ? () => void copyReport() : undefined}
          onReportFalsePositive={() => setNotice(t("scanner.falsePositive.reported"))}
          copied={copied}
        />

        {notice ? (
          <Text
            accessibilityRole="alert"
            style={{ color: tokens.c.success, textAlign: isRTL ? "right" : "left" }}
          >
            {notice}
          </Text>
        ) : null}

        <ScanHistoryMobile
          items={history}
          loading={historyLoading}
          error={historyError}
          onRetry={() => void loadHistory()}
          expanded={expanded}
          onToggleExpanded={() => setExpanded((current) => !current)}
          onSelect={(item) => {
            setKind(item.kind)
            setValue(item.preview)
            setResult(fromHistory(item))
            setError(null)
            setNotice(null)
          }}
        />
      </ScrollView>
    </View>
  )
}
