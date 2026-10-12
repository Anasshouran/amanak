import type { AIResponse, AITopic, ScanResultRecord } from "@amanak/shared-types"
import { useState } from "react"
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
  Tabs,
} from "../design/components"
import { IconAI } from "../design/icons"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { api } from "../lib/api"
import { errorMessage, useAsync } from "../lib/useAsync"

const TOPICS: AITopic[] = ["phishing", "passwords", "2fa", "general"]

function isDisabled(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | undefined
  return `${e?.code ?? ""} ${e?.message ?? ""}`.toLowerCase().includes("disabled")
}

function ResponseCard({ response }: { response: AIResponse }) {
  const t = useT()
  return (
    <Card padded elevated title={t("ai.response")}>
      <p style={{ whiteSpace: "pre-wrap" }}>{response.text}</p>
      <hr className="amk-divider" />
      <div className="amk-row amk-muted" style={{ fontSize: 12 }}>
        <span>
          {t("ai.provider")}: {response.provider}
        </span>
        <span>
          {t("ai.tokens")}: {response.tokens_used}
        </span>
      </div>
    </Card>
  )
}

export function AIAssistant() {
  const t = useT()
  const { locale } = useTheme()

  const [mode, setMode] = useState<"guidance" | "explain">("guidance")
  const [topic, setTopic] = useState<AITopic>("phishing")
  const [scanId, setScanId] = useState("")
  const [response, setResponse] = useState<AIResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [disabled, setDisabled] = useState(false)
  const [busy, setBusy] = useState(false)

  const history = useAsync<ScanResultRecord[]>(() => api.scanHistory())

  async function run(action: () => Promise<AIResponse>) {
    setBusy(true)
    setError(null)
    setResponse(null)
    try {
      setResponse(await action())
    } catch (err) {
      if (isDisabled(err)) setDisabled(true)
      else setError(errorMessage(err, t("ai.unavailable")))
    } finally {
      setBusy(false)
    }
  }

  if (disabled) {
    return (
      <div className="amk-page">
        <div className="amk-page-head">
          <div>
            <h1>{t("ai.title")}</h1>
            <p>{t("ai.subtitle")}</p>
          </div>
        </div>
        <EmptyState
          icon={<IconAI size={30} />}
          title={t("ai.disabled.title")}
          description={t("ai.disabled.description")}
        />
      </div>
    )
  }

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{t("ai.title")}</h1>
          <p>{t("ai.subtitle")}</p>
        </div>
      </div>

      <Card padded elevated>
        <Tabs
          ariaLabel={t("ai.title")}
          value={mode}
          onChange={(id) => {
            setMode(id as "guidance" | "explain")
            setResponse(null)
            setError(null)
          }}
          items={[
            { id: "guidance", label: t("ai.getGuidance") },
            { id: "explain", label: t("ai.explainScan") },
          ]}
        />

        <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
          {mode === "guidance" ? (
            <>
              <div className="amk-field">
                <label className="amk-label" htmlFor="ai-topic">
                  {t("ai.topic")}
                </label>
                <select
                  id="ai-topic"
                  className="amk-select"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as AITopic)}
                >
                  {TOPICS.map((value) => (
                    <option key={value} value={value}>
                      {t(`ai.topic.${value}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="amk-row">
                <Button
                  loading={busy}
                  icon={<IconAI size={16} />}
                  onClick={() => void run(() => api.aiGuidance(topic))}
                >
                  {t("ai.getGuidance")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Input
                label={t("ai.scanId")}
                value={scanId}
                onChange={(e) => setScanId(e.target.value)}
                placeholder={t("ai.scanPlaceholder")}
                dir="ltr"
              />
              {history.data && history.data.length > 0 && (
                <div className="amk-field">
                  <span className="amk-label">{t("ai.recentScan")}</span>
                  <div className="amk-row">
                    {history.data.slice(0, 3).map((scan) => (
                      <Button
                        key={scan.id}
                        variant="secondary"
                        size="sm"
                        onClick={() => setScanId(String(scan.id))}
                      >
                        #{scan.id}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <div className="amk-row">
                <Button
                  loading={busy}
                  disabled={!scanId.trim()}
                  icon={<IconAI size={16} />}
                  onClick={() => void run(() => api.aiExplainScan(scanId, locale))}
                >
                  {t("ai.explainScan")}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      {busy && (
        <Card padded elevated>
          <div className="amk-stack">
            <Skeleton height={16} />
            <Skeleton height={16} />
            <Skeleton height={16} width="60%" />
          </div>
        </Card>
      )}

      {error && <ErrorState title={t("ai.unavailable")} message={error} />}

      {response && !busy && <ResponseCard response={response} />}
    </div>
  )
}
