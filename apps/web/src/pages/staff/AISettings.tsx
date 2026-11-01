import { useEffect, useState } from "react"
import { api } from "../../lib/api"
import { useT } from "../../design/i18n"
import {
  Card,
  Button,
  Input,
  Badge,
  Toast,
  Skeleton,
  ErrorState,
  ConfirmModal,
} from "../../design/components"
import type {
  AISettings as AISettingsType,
  AITestResult,
  APIKeyStatus,
  AIProviderOption,
} from "@amanak/shared-types"

type ProviderId = AISettingsType["provider"]

const PROVIDER_PLACEHOLDERS: Record<ProviderId, string> = {
  "": "",
  ollama: "llama3.1:8b",
  anthropic: "claude-3-5-haiku-20241022",
  groq: "llama-3.1-70b-versatile",
  openrouter: "openrouter/auto",
}

export default function AISettings() {
  const t = useT()
  const [config, setConfig] = useState<AISettingsType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<AITestResult | null>(null)
  const [showDisableConfirm, setShowDisableConfirm] = useState(false)
  const [toast, setToast] = useState<
    { kind: "success" | "error"; msg: string } | null
  >(null)

  // form state
  const [provider, setProvider] = useState<ProviderId>("")
  const [model, setModel] = useState("")
  const [cloudConsent, setCloudConsent] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getAISettings()
      setConfig(data)
      setProvider(data.provider)
      setModel(data.model)
      setCloudConsent(data.cloud_consent)
    } catch (e: any) {
      if (e.status === 403) {
        setError("forbidden")
      } else {
        setError(e.message || "load_failed")
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(); }, [])

  const isCloud = provider === "anthropic" || provider === "groq" || provider === "openrouter"
  const canSave = provider === "" ? false : (!isCloud || cloudConsent)

  const handleSave = async () => {
    setSaving(true)
    setToast(null)
    try {
      const updated = await api.updateAISettings({
        provider,
        model: model.trim() || PROVIDER_PLACEHOLDERS[provider],
        is_enabled: provider !== "",
        cloud_consent: isCloud ? cloudConsent : false,
      })
      setConfig(updated)
      setToast({ kind: "success", msg: t("staff.ai_settings.saved") })
    } catch (e: any) {
      setToast({ kind: "error", msg: e.message || "save_failed" })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.testAIProvider({
        provider,
        model: model.trim() || PROVIDER_PLACEHOLDERS[provider],
      })
      setTestResult(result)
    } catch (e: any) {
      setTestResult({ ok: false, error: e.message || "test_failed", duration_ms: 0 })
    } finally {
      setTesting(false)
    }
  }

  const handleDisable = async () => {
    try {
      const updated = await api.disableAI()
      setConfig(updated)
      setProvider("")
      setModel("")
      setCloudConsent(false)
      setShowDisableConfirm(false)
      setToast({ kind: "success", msg: t("staff.ai_settings.disabled") })
    } catch (e: any) {
      setToast({ kind: "error", msg: e.message || "disable_failed" })
    }
  }

  if (loading) return <div className="staff-ai-settings"><Skeleton height={400} /></div>
  if (error === "forbidden") return <ErrorState title={t("common.forbidden")} message={t("staff.ai_settings.forbidden")} onRetry={load} />
  if (error) return <ErrorState title={t("common.error")} message={error} onRetry={load} />
  if (!config) return null

  return (
    <div className="staff-ai-settings">
      <header className="staff-ai-settings__header">
        <h1>{t("staff.ai_settings.title")}</h1>
        <p className="muted">{t("staff.ai_settings.subtitle")}</p>
      </header>

      {/* Current status */}
      <Card>
        <h2>{t("staff.ai_settings.current_status")}</h2>
        <dl className="kv">
          <dt>{t("staff.ai_settings.provider_label")}</dt>
          <dd><code>{config.provider || "—"}</code></dd>
          <dt>{t("staff.ai_settings.model_label")}</dt>
          <dd><code>{config.model || "—"}</code></dd>
          <dt>{t("common.status")}</dt>
          <dd>
            <Badge variant={config.is_enabled ? "success" : "neutral"}>
              {config.is_enabled ? t("common.enabled") : t("common.disabled")}
            </Badge>
          </dd>
          {config.updated_by && (
            <>
              <dt>{t("staff.ai_settings.updated_by")}</dt>
              <dd>{config.updated_by.email} · {new Date(config.updated_at).toLocaleString()}</dd>
            </>
          )}
        </dl>
      </Card>

      {/* Provider selection */}
      <Card>
        <h2>{t("staff.ai_settings.select_provider")}</h2>

        <div role="radiogroup" className="provider-radios">
          {config.available_providers.map((opt) => (
            <label key={opt.id || "disabled"} className="provider-radio">
              <input
                type="radio"
                name="provider"
                value={opt.id}
                checked={provider === opt.id}
                onChange={() => { setProvider(opt.id); setTestResult(null); }}
              />
              <span>{opt.label}</span>
              {opt.id && opt.id !== "ollama" && !config.api_keys_status[opt.id]?.available && (
                <Badge variant="warning">{t("staff.ai_settings.api_key_missing")}</Badge>
              )}
            </label>
          ))}
        </div>

        {provider !== "" && (
          <div className="form-row">
            <label>
              {t("staff.ai_settings.model_label")}
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={PROVIDER_PLACEHOLDERS[provider]}
              />
            </label>
          </div>
        )}

        {isCloud && (
          <label className="form-row form-row--checkbox">
            <input
              type="checkbox"
              checked={cloudConsent}
              onChange={(e) => setCloudConsent(e.target.checked)}
            />
            <span>
              {t("staff.ai_settings.cloud_consent_label")}
              <small className="muted">{t("staff.ai_settings.cloud_consent_hint")}</small>
            </span>
          </label>
        )}

        <div className="actions">
          <Button onClick={handleTest} disabled={provider === "" || testing}>
            {testing ? "…" : t("staff.ai_settings.test_connection")}
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving} variant="primary">
            {saving ? "…" : t("staff.ai_settings.save")}
          </Button>
        </div>

        {testResult && (
          <div className={`test-result test-result--${testResult.ok ? "ok" : "fail"}`}>
            {testResult.ok
              ? `${t("staff.ai_settings.test_ok")} · ${testResult.duration_ms}ms`
              : `${t("staff.ai_settings.test_failed")}: ${testResult.error} · ${testResult.duration_ms}ms`}
          </div>
        )}
      </Card>

      {/* API keys status */}
      <Card>
        <h2>{t("staff.ai_settings.api_keys_status")}</h2>
        <ul className="api-keys">
          {Object.entries(config.api_keys_status).map(([id, status]) => (
            <li key={id}>
              <strong>{id}</strong>:{" "}
              {status.available
                ? <Badge variant="success">{t("staff.ai_settings.api_key_set")}</Badge>
                : <Badge variant="danger">{t("staff.ai_settings.api_key_missing")}</Badge>}
              {" "}<small className="muted">{status.note}</small>
            </li>
          ))}
        </ul>
      </Card>

      {/* Danger zone */}
      {config.is_enabled && (
        <Card>
          <Button variant="danger" onClick={() => setShowDisableConfirm(true)}>
            {t("staff.ai_settings.disable")}
          </Button>
        </Card>
      )}

      {showDisableConfirm && (
        <ConfirmModal open={showDisableConfirm}
          title={t("staff.ai_settings.disable")}
          description={t("staff.ai_settings.disable_confirm")}
          confirmText={t("staff.ai_settings.disable")}
          onConfirm={handleDisable}
          onClose={() => setShowDisableConfirm(false)}
        />
      )}

      {toast && <Toast variant={toast.kind}
        message={toast.msg} durationMs={5000} onDismiss={() => setToast(null)} />}
    </div>
  )
}