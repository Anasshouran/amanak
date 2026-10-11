import { useState, type FormEvent } from "react"
import { api } from "../lib/api"
import type { AIResponse, AITopic } from "@amanak/shared-types"

const TOPICS: { id: AITopic; label: string }[] = [
  { id: "phishing", label: "Phishing" },
  { id: "passwords", label: "Passwords" },
  { id: "2fa", label: "2FA" },
  { id: "general", label: "General" },
]

function errorCode(err: unknown): string | undefined {
  return (err as { code?: string } | undefined)?.code
}

export function AIAssistant() {
  const [topic, setTopic] = useState<AITopic>("phishing")
  const [scanId, setScanId] = useState("")
  const [result, setResult] = useState<AIResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<AIResponse>) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      setResult(await fn())
    } catch (err) {
      setResult(null)
      setError(
        errorCode(err) === "ai_disabled"
          ? "AI is disabled by configuration."
          : "The AI assistant is unavailable right now.",
      )
    } finally {
      setBusy(false)
    }
  }

  function onGuidance(e: FormEvent) {
    e.preventDefault()
    void run(() => api.aiGuidance(topic))
  }

  function onExplain(e: FormEvent) {
    e.preventDefault()
    void run(() => api.aiExplainScan(scanId))
  }

  return (
    <div>
      <h2>AI Assistant</h2>
      <p style={{ color: "#94a3b8" }}>
        Guidance is generated from curated, offline knowledge. Prompts are redacted before any provider call and
        only hashes are stored. AI is disabled unless explicitly enabled.
      </p>

      <form onSubmit={onGuidance} style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          {TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTopic(t.id)}
              style={{
                padding: "0.4rem 0.9rem",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                background: topic === t.id ? "#38bdf8" : "#1e293b",
                color: topic === t.id ? "#0f172a" : "#94a3b8",
                fontWeight: 600,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button type="submit" disabled={busy}>
          Get guidance
        </button>
      </form>

      <form onSubmit={onExplain} style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          style={{ flex: 1 }}
          placeholder="Scan ID"
          value={scanId}
          onChange={(e) => setScanId(e.target.value)}
        />
        <button type="submit" disabled={busy}>
          {busy ? "Working…" : "Explain scan"}
        </button>
      </form>

      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      {result && (
        <div style={{ background: "#1e293b", borderRadius: 8, padding: "1rem" }}>
          <p style={{ color: "#38bdf8", margin: 0, fontWeight: 600 }}>
            {result.provider} · {result.model} · {result.tokens_used} tokens
          </p>
          <p style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{result.text}</p>
        </div>
      )}
    </div>
  )
}
