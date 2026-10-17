import type { ScanKind, ScanResultRecord, ScanResponse } from "@amanak/shared-types"
import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, ErrorState, Skeleton, useToast } from "../design/components"
import { IconChevron } from "../design/icons"
import { useT } from "../design/i18n"
import { api } from "../lib/api"
import { errorMessage, useAsync } from "../lib/useAsync"
import {
  ScanHistory,
  ScanInput,
  ScanResult,
  ScanTabs,
  type ScanResultView,
} from "../components/scanner"

function fromResponse(result: ScanResponse, input: string): ScanResultView {
  return {
    verdict: result.verdict,
    score: result.score,
    matches: result.matches,
    rulesetVersion: result.ruleset_version,
    input,
    scannedAt: result.scanned_at,
  }
}

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

export function Scanner() {
  const t = useT()
  const { push } = useToast()
  const [params, setParams] = useSearchParams()
  const kind: ScanKind = params.get("tab") === "message" ? "message" : "url"

  const [value, setValue] = useState("")
  const [result, setResult] = useState<ScanResultView | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyExpanded, setHistoryExpanded] = useState(false)

  const history = useAsync<ScanResultRecord[]>(() => api.scanHistory())
  const allHistory = history.data ?? []

  function setKind(next: ScanKind) {
    const nextParams = new URLSearchParams(params)
    if (next === "message") nextParams.set("tab", "message")
    else nextParams.delete("tab")
    setParams(nextParams, { replace: true })
    setValue("")
    setResult(null)
    setError(null)
  }

  async function onScan(input: string) {
    if (!input.trim()) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = kind === "url" ? await api.scanUrl(input) : await api.scanMessage(input)
      setResult(fromResponse(res, input))
      history.reload()
    } catch (err) {
      setError(errorMessage(err, t("common.error")))
    } finally {
      setBusy(false)
    }
  }

  function onScanAnother() {
    setResult(null)
    setError(null)
    setValue("")
  }

  async function onCopyReport() {
    if (!result) return
    const lines = [
      `${t("scanner.result.title")}: ${t(`scanner.verdict.${result.verdict}`)}`,
      `${t("scanner.result.details.url")}: ${result.input}`,
      `${t("scanner.result.details.riskLevel")}: ${result.verdict}`,
      ...result.matches.map((m) => `- ${m.rule_id} (${m.severity}): ${m.description}`),
    ]
    await navigator.clipboard?.writeText(lines.join("\n"))
    push(t("actions.copied"), "success")
  }

  function onReportFalsePositive() {
    push(t("scanner.falsePositive.reported"), "success")
  }

  return (
    <div className="amk-page scan-page">
      <div className="amk-page-head">
        <div>
          <h1>{t("scanner.title")}</h1>
          <p>{t("scanner.subtitle")}</p>
        </div>
      </div>

      <div className="scan-layout">
        <div className="scan-layout__main">
          <ScanTabs value={kind} onChange={setKind} />

          <Card padded elevated className="scan-input-card">
            <ScanInput
              kind={kind}
              value={value}
              onChange={setValue}
              onSubmit={(v) => void onScan(v)}
              busy={busy}
            />
          </Card>

          {busy && (
            <Card padded elevated className="scan-result-skeleton" aria-hidden="true">
              <div className="amk-stack">
                <Skeleton width={140} height={20} />
                <Skeleton height={120} />
                <Skeleton height={80} />
                <Skeleton height={40} />
              </div>
            </Card>
          )}

          {!busy && error && (
            <ErrorState
              title={t("common.error")}
              message={error}
              onRetry={() => void onScan(value)}
              retryLabel={t("scanner.action.tryAgain")}
            />
          )}

          {!busy && !error && result && (
            <ScanResult
              result={result}
              onScanAnother={onScanAnother}
              onCopyReport={() => void onCopyReport()}
              onReportFalsePositive={onReportFalsePositive}
            />
          )}
        </div>

        <details
          open
          className="amk-card amk-card--padded amk-card--elevated scan-sidebar"
        >
          <summary className="scan-sidebar__summary">
            <h2 className="amk-card__title">{t("scanner.history.title")}</h2>
            <IconChevron size={16} className="scan-sidebar__chevron" />
          </summary>
          <div className="scan-sidebar__body">
            {history.loading ? (
              <div className="amk-stack">
                <Skeleton height={44} />
                <Skeleton height={44} />
                <Skeleton height={44} />
              </div>
            ) : history.error ? (
              <ErrorState
                title={t("common.error")}
                onRetry={history.reload}
                retryLabel={t("scanner.action.tryAgain")}
              />
            ) : (
              <>
                <ScanHistory
                  items={historyExpanded ? allHistory : allHistory.slice(0, 5)}
                  onSelect={(item) => {
                    setKind(item.kind)
                    setResult(fromHistory(item))
                    setError(null)
                  }}
                />
                {allHistory.length > 5 && (
                  <button
                    type="button"
                    className="scan-sidebar__viewall"
                    onClick={() => setHistoryExpanded((v) => !v)}
                  >
                    {historyExpanded
                      ? t("scanner.history.showLess")
                      : t("scanner.history.viewAll")}
                  </button>
                )}
              </>
            )}
          </div>
        </details>
      </div>
    </div>
  )
}
