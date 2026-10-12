import type { ScanKind, ScanResponse, ScanResultRecord } from "@amanak/shared-types"
import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Skeleton,
  Tabs,
  Textarea,
} from "../design/components"
import { IconScanner } from "../design/icons"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { api } from "../lib/api"
import { formatDateTime } from "../lib/format"
import { severityVariant, verdictVariant } from "../lib/labels"
import { errorMessage, useAsync } from "../lib/useAsync"

function ScanResultCard({ result }: { result: ScanResponse }) {
  const t = useT()
  return (
    <Card padded elevated title={t("scanner.result.title")}>
      <div className="amk-row" style={{ justifyContent: "space-between" }}>
        <Badge variant={verdictVariant(result.verdict)}>{t(`scanner.verdict.${result.verdict}`)}</Badge>
        <span className="amk-muted">
          {t("common.score")}: <strong>{result.score}</strong>
        </span>
      </div>
      <p className="amk-muted" style={{ fontSize: 12, marginTop: 4 }}>
        {t("scanner.ruleset")}: {result.ruleset_version}
      </p>
      <hr className="amk-divider" />
      {result.matches.length === 0 ? (
        <p className="amk-muted">{t("scanner.noMatches")}</p>
      ) : (
        <div>
          {result.matches.map((match, index) => (
            <div className="amk-match" key={`${match.rule_id}-${index}`}>
              <div className="amk-row" style={{ justifyContent: "space-between" }}>
                <span className="amk-mono">
                  {t("scanner.match.rule")}: {match.rule_id}
                </span>
                <Badge variant={severityVariant(match.severity)}>
                  {t(`scanner.severity.${match.severity}`)}
                </Badge>
              </div>
              <p>{match.description}</p>
              {match.evidence_redacted && (
                <code className="amk-mono amk-muted">{match.evidence_redacted}</code>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export function Scanner() {
  const t = useT()
  const { locale } = useTheme()
  const [params, setParams] = useSearchParams()
  const kind: ScanKind = params.get("tab") === "message" ? "message" : "url"

  const [value, setValue] = useState("")
  const [result, setResult] = useState<ScanResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const history = useAsync<ScanResultRecord[]>(() => api.scanHistory())

  function setKind(next: string) {
    const next_params = new URLSearchParams(params)
    if (next === "message") next_params.set("tab", "message")
    else next_params.delete("tab")
    setParams(next_params, { replace: true })
    setResult(null)
    setError(null)
  }

  async function onScan() {
    if (!value.trim()) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = kind === "url" ? await api.scanUrl(value) : await api.scanMessage(value)
      setResult(res)
      history.reload()
    } catch (err) {
      setError(errorMessage(err, t("common.error")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{t("scanner.title")}</h1>
          <p>{t("scanner.subtitle")}</p>
        </div>
      </div>

      <div className="amk-grid amk-grid--two">
        <div className="amk-stack">
          <Card padded elevated>
            <Tabs
              ariaLabel={t("scanner.title")}
              value={kind}
              onChange={setKind}
              items={[
                { id: "url", label: t("scanner.tab.url") },
                { id: "message", label: t("scanner.tab.message") },
              ]}
            />
            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              <Textarea
                aria-label={kind === "url" ? t("scanner.tab.url") : t("scanner.tab.message")}
                placeholder={kind === "url" ? t("scanner.input.url") : t("scanner.input.message")}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                dir="ltr"
              />
              <div className="amk-row">
                <Button
                  loading={busy}
                  disabled={!value.trim()}
                  icon={<IconScanner size={16} />}
                  onClick={() => void onScan()}
                >
                  {busy ? t("scanner.scanning") : t("scanner.submit")}
                </Button>
              </div>
            </div>
          </Card>

          {busy && (
            <Card padded elevated>
              <div className="amk-stack">
                <Skeleton width={140} height={20} />
                <Skeleton height={120} />
                <Skeleton height={40} />
              </div>
            </Card>
          )}

          {error && (
            <ErrorState
              title={t("common.error")}
              message={error}
              onRetry={() => void onScan()}
              retryLabel={t("actions.retry")}
            />
          )}

          {result && <ScanResultCard result={result} />}
        </div>

        <Card padded elevated title={t("scanner.history.title")}>
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
              retryLabel={t("actions.retry")}
            />
          ) : !history.data || history.data.length === 0 ? (
            <p className="amk-muted">{t("scanner.history.empty")}</p>
          ) : (
            <ul className="amk-list">
              {history.data.slice(0, 10).map((scan) => (
                <li className="amk-listitem" key={scan.id}>
                  <div style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
                    <span
                      className="amk-mono"
                      style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {scan.preview}
                    </span>
                    <span className="amk-muted" style={{ fontSize: 12 }}>
                      {t(`scanner.tab.${scan.kind}`)} · {formatDateTime(scan.created_at, locale)}
                    </span>
                  </div>
                  <Badge variant={verdictVariant(scan.verdict)}>
                    {t(`scanner.verdict.${scan.verdict}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
